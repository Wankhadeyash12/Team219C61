import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' } })
mongoose.set('bufferCommands', false)
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '2mb' }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }))

const userSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true }, password: String, role: { type: String, enum: ['CITIZEN', 'AUTHORITY', 'ADMIN', 'FIELD_WORKER'], default: 'CITIZEN' } }, { timestamps: true })
const issueSchema = new mongoose.Schema({ issueId: { type: String, unique: true }, title: String, description: String, category: String, images: [String], location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: [79.0882, 21.1458] } }, address: String, reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, status: { type: String, default: 'REPORTED' }, severity: String, priorityScore: Number, aiAnalysis: mongoose.Schema.Types.Mixed, department: String, assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, communityConfirmations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], timeline: [{ label: String, at: Date }] }, { timestamps: true })
issueSchema.index({ location: '2dsphere' })
const notificationSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, message: String, read: { type: Boolean, default: false } }, { timestamps: true })
const departmentSchema = new mongoose.Schema({ name: { type: String, unique: true }, code: String, active: { type: Boolean, default: true } }, { timestamps: true })
const fieldTeamSchema = new mongoose.Schema({ name: String, department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, lead: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, ward: String, active: { type: Boolean, default: true } }, { timestamps: true })
const User = mongoose.model('User', userSchema)
const Issue = mongoose.model('Issue', issueSchema)
const Notification = mongoose.model('Notification', notificationSchema)
const Department = mongoose.model('Department', departmentSchema)
const FieldTeam = mongoose.model('FieldTeam', fieldTeamSchema)

const tokenFor = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'dev-only-secret', { expiresIn: '7d' })
const auth = async (req, res, next) => { try { const token = req.headers.authorization?.replace('Bearer ', ''); if (!token) return res.status(401).json({ message: 'Authentication required' }); req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-secret'); next() } catch { res.status(401).json({ message: 'Invalid or expired token' }) } }
const issueId = () => `CIV-${Math.floor(1000 + Math.random() * 8999)}`

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'CivicPulse API' }))
app.post('/api/auth/register', async (req, res, next) => { try { const { name, email, password, role = 'CITIZEN' } = req.body; if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' }); const user = await User.create({ name, email: email.toLowerCase(), password: await bcrypt.hash(password, 12), role }); res.status(201).json({ token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } }) } catch (error) { next(error) } })
app.post('/api/auth/login', async (req, res, next) => { try { const user = await User.findOne({ email: req.body.email?.toLowerCase() }); if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) return res.status(401).json({ message: 'Invalid credentials' }); res.json({ token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } }) } catch (error) { next(error) } })
app.get('/api/auth/me', auth, async (req, res, next) => { try { res.json(await User.findById(req.user.id).select('-password')) } catch (error) { next(error) } })
app.get('/api/issues', async (req, res, next) => { try { res.json(await Issue.find().sort({ priorityScore: -1, createdAt: -1 }).populate('reportedBy', 'name')) } catch (error) { next(error) } })
app.get('/api/authority/dashboard', auth, async (req, res, next) => { try { if (!['AUTHORITY', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ message: 'Authority access required' }); const [total, pending, inProgress, resolved, departments, fieldTeams] = await Promise.all([Issue.countDocuments(), Issue.countDocuments({ status: { $nin: ['RESOLVED', 'REJECTED'] } }), Issue.countDocuments({ status: 'IN_PROGRESS' }), Issue.countDocuments({ status: 'RESOLVED' }), Department.find({ active: true }).sort({ name: 1 }), FieldTeam.find({ active: true }).populate('department', 'name').populate('lead', 'name')]); res.json({ metrics: { total, pending, inProgress, resolved, resolutionRate: total ? Math.round((resolved / total) * 100) : 0 }, departments, fieldTeams }) } catch (error) { next(error) } })
app.get('/api/issues/nearby', async (req, res, next) => { try { const { lat, lng, radius = 5000 } = req.query; const issues = await Issue.find({ location: { $near: { $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] }, $maxDistance: Number(radius) } } }); res.json(issues) } catch (error) { next(error) } })
app.post('/api/issues', auth, async (req, res, next) => { try { const issue = await Issue.create({ ...req.body, issueId: issueId(), reportedBy: req.user.id, priorityScore: Number(req.body.priorityScore || 5), timeline: [{ label: 'Reported', at: new Date() }] }); io.emit('issue:created', issue); res.status(201).json(issue) } catch (error) { next(error) } })
app.patch('/api/issues/:id', auth, async (req, res, next) => { try { const issue = await Issue.findByIdAndUpdate(req.params.id, { $set: req.body, $push: { timeline: { label: req.body.status || 'Updated', at: new Date() } } }, { new: true }); io.emit('issue:updated', issue); if (issue?.reportedBy) await Notification.create({ user: issue.reportedBy, message: `Your report ${issue.issueId} was updated.` }); res.json(issue) } catch (error) { next(error) } })
app.post('/api/issues/:id/confirm', auth, async (req, res, next) => { try { const issue = await Issue.findByIdAndUpdate(req.params.id, { $addToSet: { communityConfirmations: req.user.id } }, { new: true }); res.json(issue) } catch (error) { next(error) } })
app.get('/api/notifications', auth, async (req, res, next) => { try { res.json(await Notification.find({ user: req.user.id }).sort({ createdAt: -1 })) } catch (error) { next(error) } })
app.post('/api/ai/analyze-image', async (req, res) => { if (!process.env.AI_API_KEY) return res.status(503).json({ available: false, message: 'AI analysis unavailable — please select the category manually.' }); res.status(501).json({ available: false, message: 'Configure an AI provider adapter before analysis.' }) })
app.use((error, req, res, next) => { console.error(error); res.status(500).json({ message: 'Unexpected server error' }) })
io.on('connection', (socket) => socket.emit('connected', { message: 'Connected to CivicPulse live updates' }))
const port = Number(process.env.PORT || 5000)
if (process.env.MONGODB_URI) mongoose.connect(process.env.MONGODB_URI).then(() => httpServer.listen(port, () => console.log(`CivicPulse API listening on ${port}`))).catch((error) => { console.error('MongoDB unavailable:', error.message); httpServer.listen(port, () => console.log(`CivicPulse API listening on ${port} without database`)) })
else httpServer.listen(port, () => console.log(`CivicPulse API listening on ${port} without database`))

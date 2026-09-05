import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({ name: String, email: String, password: String, role: String })
const issueSchema = new mongoose.Schema({ issueId: String, title: String, description: String, category: String, address: String, status: String, severity: String, priorityScore: Number, location: { type: { type: String }, coordinates: [Number] }, timeline: [{ label: String, at: Date }], reportedBy: mongoose.Schema.Types.ObjectId }, { timestamps: true })
const departmentSchema = new mongoose.Schema({ name: String, code: String, active: Boolean })
const fieldTeamSchema = new mongoose.Schema({ name: String, department: mongoose.Schema.Types.ObjectId, lead: mongoose.Schema.Types.ObjectId, ward: String, active: Boolean })
const User = mongoose.model('User', userSchema)
const Issue = mongoose.model('Issue', issueSchema)
const Department = mongoose.model('Department', departmentSchema)
const FieldTeam = mongoose.model('FieldTeam', fieldTeamSchema)
const password = await bcrypt.hash('CivicPulse2026!', 12)
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civicpulse')
await User.deleteMany({ email: { $in: ['citizen@demo.com', 'authority@demo.com', 'worker@demo.com', 'admin@demo.com'] } })
const users = await User.insertMany([
  { name: 'Arjun Sharma', email: 'citizen@demo.com', password, role: 'CITIZEN' },
  { name: 'Meera Joshi', email: 'authority@demo.com', password, role: 'AUTHORITY' },
  { name: 'Ravi Patil', email: 'worker@demo.com', password, role: 'FIELD_WORKER' },
  { name: 'CivicPulse Admin', email: 'admin@demo.com', password, role: 'ADMIN' },
])
await Department.deleteMany({})
const departments = await Department.insertMany([
  { name: 'Road Maintenance', code: 'ROAD_MAINTENANCE', active: true },
  { name: 'Water & Drainage', code: 'WATER_DRAINAGE', active: true },
  { name: 'Electrical Services', code: 'ELECTRICAL_SERVICES', active: true },
  { name: 'Sanitation', code: 'SANITATION', active: true },
])
await FieldTeam.deleteMany({})
await FieldTeam.insertMany([
  { name: 'Road Response Alpha', department: departments[0]._id, lead: users[2]._id, ward: 'Ward 12', active: true },
  { name: 'Water Response North', department: departments[1]._id, lead: users[2]._id, ward: 'Ward 08', active: true },
])
await Issue.deleteMany({ issueId: /^CIV-DEMO/ })
await Issue.insertMany([
  { issueId: 'CIV-DEMO-1042', title: 'Large pothole near school crossing', description: 'Deep road damage creating a risk for two-wheelers.', category: 'POTHOLE', address: 'Civil Lines, Nagpur', status: 'IN_PROGRESS', severity: 'CRITICAL', priorityScore: 9.8, location: { type: 'Point', coordinates: [79.0882, 21.1458] }, reportedBy: users[0]._id, timeline: [{ label: 'Reported', at: new Date() }, { label: 'Assigned', at: new Date() }] },
  { issueId: 'CIV-DEMO-1048', title: 'Water leakage on main road', description: 'Continuous leakage near the Dharampeth junction.', category: 'WATER_LEAKAGE', address: 'Dharampeth, Nagpur', status: 'REPORTED', severity: 'HIGH', priorityScore: 8.6, location: { type: 'Point', coordinates: [79.062, 21.135] }, reportedBy: users[0]._id, timeline: [{ label: 'Reported', at: new Date() }] },
])
console.log('Seed complete. Demo password: CivicPulse2026!')
await mongoose.disconnect()

import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [3, 'Project name must be at least 3 characters'],
      maxlength: [100, 'Project name cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true
    },
    assignedLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Lead assignment is required']
    },
    assignedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    progress: {
      type: Number,
      default: 0,
      min: [0, 'Progress cannot be negative'],
      max: [100, 'Progress cannot exceed 100']
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'on_hold', 'cancelled'],
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required']
    },
    completedAt: {
      type: Date
    },
    totalEstimatedHours: {
      type: Number,
      default: 0
    },
    totalActualHours: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    
    basePoints: {
      type: Number,
      default: 100
    },
    pointsDistributed: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for modules
projectSchema.virtual('modules', {
  ref: 'Module',
  localField: '_id',
  foreignField: 'project'
});

// Method to calculate progress based on modules
projectSchema.methods.calculateProgress = async function() {
  const Module = mongoose.model('Module');
  const modules = await Module.find({ project: this._id });
  
  if (modules.length === 0) {
    this.progress = 0;
    return 0;
  }
  
  const totalProgress = modules.reduce((sum, module) => sum + module.progress, 0);
  const totalEstimated = modules.reduce((sum, module) => sum + module.estimatedTime, 0);
  const totalActual = modules.reduce((sum, module) => sum + module.actualTime, 0);
  
  this.progress = Math.round(totalProgress / modules.length);
  this.totalEstimatedHours = totalEstimated;
  this.totalActualHours = totalActual;
  
  // Check if project is completed
  if (this.progress === 100 && this.status !== 'completed') {
    this.status = 'completed';
    this.completedAt = new Date();
    
    // Trigger points calculation
    if (!this.pointsDistributed) {
      await this.calculateAndDistributePoints();
    }
  }
  
  return this.progress;
};

// Method to calculate and distribute points
projectSchema.methods.calculateAndDistributePoints = async function() {
  if (this.pointsDistributed) {
    return;
  }
  
  const UserStats = mongoose.model('UserStats');
  const DailyUpdate = mongoose.model('DailyUpdate');
  
  // Calculate efficiency multiplier
  let efficiencyMultiplier = 1;
  if (this.totalActualHours > 0 && this.totalEstimatedHours > 0) {
    const efficiency = this.totalEstimatedHours / this.totalActualHours;
    
    if (efficiency >= 1) {
      // Completed on time or early
      efficiencyMultiplier = 1 + (efficiency - 1) * 0.5; // Bonus for efficiency
    } else {
      // Took longer than estimated
      efficiencyMultiplier = efficiency; // Penalty
    }
  }
  
  // Calculate deadline bonus/penalty
  let deadlineMultiplier = 1;
  if (this.completedAt && this.deadline) {
    const completedTime = new Date(this.completedAt).getTime();
    const deadlineTime = new Date(this.deadline).getTime();
    const daysDifference = (deadlineTime - completedTime) / (1000 * 60 * 60 * 24);
    
    if (daysDifference > 0) {
      // Completed before deadline
      deadlineMultiplier = 1 + Math.min(daysDifference / 10, 0.5); // Max 50% bonus
    } else if (daysDifference < 0) {
      // Completed after deadline
      deadlineMultiplier = Math.max(1 + daysDifference / 20, 0.5); // Max 50% penalty
    }
  }
  
  // Total project points
  const totalPoints = this.basePoints * efficiencyMultiplier * deadlineMultiplier;
  
  // Lead gets 40% of total points
  const leadPoints = Math.round(totalPoints * 0.4);
  
  // Get lead stats
  let leadStats = await UserStats.findOne({ user: this.assignedLead });
  if (!leadStats) {
    leadStats = await UserStats.create({ user: this.assignedLead });
  }
  
  // Add to lead's stats
  leadStats.addProjectToHistory({
    project: this._id,
    role: 'lead',
    pointsEarned: leadPoints,
    hoursWorked: this.totalActualHours,
    completedAt: this.completedAt
  });
  
  await leadStats.save();
  
  // Remaining 60% distributed among users based on their contribution
  const userPoints = totalPoints * 0.6;
  
  // Get all users' work hours
  const userHours = {};
  const dailyUpdates = await DailyUpdate.find({ project: this._id });
  
  for (const update of dailyUpdates) {
    const userId = update.user.toString();
    if (!userHours[userId]) {
      userHours[userId] = 0;
    }
    userHours[userId] += update.hoursWorked;
  }
  
  const totalUserHours = Object.values(userHours).reduce((sum, hours) => sum + hours, 0);
  
  // Distribute points to users
  for (const [userId, hours] of Object.entries(userHours)) {
    if (totalUserHours > 0) {
      const userShare = (hours / totalUserHours) * userPoints;
      
      let userStats = await UserStats.findOne({ user: userId });
      if (!userStats) {
        userStats = await UserStats.create({ user: userId });
      }
      
      userStats.addProjectToHistory({
        project: this._id,
        role: 'member',
        pointsEarned: Math.round(userShare),
        hoursWorked: hours,
        completedAt: this.completedAt
      });
      
      await userStats.save();
    }
  }
  
  this.pointsDistributed = true;
  await this.save();
};

// Index for faster queries
projectSchema.index({ department: 1, assignedLead: 1 });
projectSchema.index({ status: 1, isActive: 1 });

const Project = mongoose.model('Project', projectSchema);

export default Project;
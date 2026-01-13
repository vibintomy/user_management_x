import mongoose from 'mongoose';

const userStatsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    totalProjects: {
      type: Number,
      default: 0
    },
    completedProjects: {
      type: Number,
      default: 0
    },
    ongoingProjects: {
      type: Number,
      default: 0
    },
    totalModules: {
      type: Number,
      default: 0
    },
    completedModules: {
      type: Number,
      default: 0
    },
    totalHoursWorked: {
      type: Number,
      default: 0
    },
    totalPoints: {
      type: Number,
      default: 0
    },
    averageCompletionRate: {
      type: Number,
      default: 0
    },
    projectHistory: [{
      project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
      },
      role: {
        type: String,
        enum: ['lead', 'member']
      },
      pointsEarned: {
        type: Number,
        default: 0
      },
      hoursWorked: {
        type: Number,
        default: 0
      },
      completedAt: {
        type: Date
      }
    }],
    monthlyStats: [{
      month: {
        type: String, // Format: "2025-01"
        required: true
      },
      projectsCompleted: {
        type: Number,
        default: 0
      },
      hoursWorked: {
        type: Number,
        default: 0
      },
      pointsEarned: {
        type: Number,
        default: 0
      }
    }]
  },
  {
    timestamps: true
  }
);

// Method to add project to history
userStatsSchema.methods.addProjectToHistory = function(projectData) {
  this.projectHistory.push(projectData);
  
  if (projectData.role === 'lead') {
    this.completedProjects += 1;
  }
  
  this.totalPoints += projectData.pointsEarned || 0;
  this.totalHoursWorked += projectData.hoursWorked || 0;
  
  // Update monthly stats
  const monthKey = new Date().toISOString().slice(0, 7); // "2025-01"
  const monthStat = this.monthlyStats.find(m => m.month === monthKey);
  
  if (monthStat) {
    monthStat.projectsCompleted += 1;
    monthStat.pointsEarned += projectData.pointsEarned || 0;
    monthStat.hoursWorked += projectData.hoursWorked || 0;
  } else {
    this.monthlyStats.push({
      month: monthKey,
      projectsCompleted: 1,
      pointsEarned: projectData.pointsEarned || 0,
      hoursWorked: projectData.hoursWorked || 0
    });
  }
  
  return this;
};

const UserStats = mongoose.model('UserStats', userStatsSchema);

export default UserStats;
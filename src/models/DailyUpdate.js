import mongoose from 'mongoose';

const dailyUpdateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required']
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required']
    },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: [true, 'Module is required']
    },
    date: {
      type: Date,
      default: Date.now,
      required: true
    },
    hoursWorked: {
      type: Number,
      required: [true, 'Hours worked is required'],
      min: [0, 'Hours worked cannot be negative'],
      max: [24, 'Hours worked cannot exceed 24 hours']
    },
    progressPercentage: {
      type: Number,
      required: [true, 'Progress percentage is required'],
      min: [0, 'Progress cannot be negative'],
      max: [100, 'Progress cannot exceed 100']
    },
    description: {
      type: String,
      required: [true, 'Update description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    blockers: {
      type: String,
      trim: true,
      maxlength: [300, 'Blockers cannot exceed 300 characters']
    },
    status: {
      type: String,
      enum: ['on_track', 'delayed', 'blocked', 'completed'],
      default: 'on_track'
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
dailyUpdateSchema.index({ user: 1, date: -1 });
dailyUpdateSchema.index({ project: 1, date: -1 });
dailyUpdateSchema.index({ module: 1 });

// Update module progress when daily update is saved
dailyUpdateSchema.post('save', async function() {
  const Module = mongoose.model('Module');
  const DailyUpdate = mongoose.model('DailyUpdate');
  
  // Get all updates for this module
  const updates = await DailyUpdate.find({ 
    module: this.module 
  }).sort({ createdAt: -1 });
  
  if (updates.length > 0) {
    const module = await Module.findById(this.module);
    if (module) {
     
      const latestProgress = updates[0].progressPercentage;
      
   
      const totalHours = updates.reduce((sum, update) => sum + update.hoursWorked, 0);
      
      module.progress = latestProgress;
      module.actualTime = totalHours;
      
      if (latestProgress === 100 && module.status !== 'completed') {
        module.status = 'completed';
        module.endDate = new Date();
      } else if (latestProgress > 0 && module.status === 'pending') {
        module.status = 'in_progress';
        if (!module.startDate) {
          module.startDate = new Date();
        }
      }
      
      await module.save();
    }
  }
});

const DailyUpdate = mongoose.model('DailyUpdate', dailyUpdateSchema);

export default DailyUpdate;
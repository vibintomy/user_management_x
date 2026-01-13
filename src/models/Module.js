import mongoose from 'mongoose';

const moduleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Module name is required'],
      trim: true,
      maxlength: [100, 'Module name cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required']
    },
    assignedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    estimatedTime: {
      type: Number, // in hours
      required: [true, 'Estimated time is required'],
      min: [0, 'Estimated time cannot be negative']
    },
    actualTime: {
      type: Number, // in hours
      default: 0,
      min: [0, 'Actual time cannot be negative']
    },
    progress: {
      type: Number,
      default: 0,
      min: [0, 'Progress cannot be negative'],
      max: [100, 'Progress cannot exceed 100']
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'blocked'],
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    }
  },
  {
    timestamps: true
  }
);

// Update project progress when module changes
moduleSchema.post('save', async function() {
  const Project = mongoose.model('Project');
  const project = await Project.findById(this.project);
  if (project) {
    await project.calculateProgress();
    await project.save();
  }
});

// Index for faster queries
moduleSchema.index({ project: 1, status: 1 });

const Module = mongoose.model('Module', moduleSchema);

export default Module;
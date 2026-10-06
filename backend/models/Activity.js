import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'project_created',
        'project_updated',
        'member_joined',
        'member_removed',
        'file_created',
        'file_saved',
        'file_deleted',
        'version_saved',
        'version_reverted',
        'github_pushed',
        'github_pulled',
      ],
    },
    details: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.index({ projectId: 1, createdAt: -1 });

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;

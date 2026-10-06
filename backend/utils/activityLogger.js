import Activity from '../models/Activity.js';

export const logActivity = async (projectId, userId, action, details, entityId = null) => {
  try {
    const activity = new Activity({
      projectId,
      user: userId,
      action,
      details,
      entityId,
    });
    await activity.save();
    return activity;
  } catch (error) {
    console.error('Failed to log activity:', error.message);
    return null;
  }
};

export default logActivity;

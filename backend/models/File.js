import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
      default: '/',
    },
    content: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: 'javascript',
    },
    isFolder: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const File = mongoose.model('File', fileSchema);
export default File;

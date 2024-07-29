const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/bativ', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Schema Definitions
const projectSchema = new mongoose.Schema({
  projectTitle: String,
  category: String,
  uploadDate: { type: Date, default: Date.now },
  sourceCodeFileName: String,
  fileLink: String
});

const newSchema = new mongoose.Schema({
  projectTitle: String,
  category: String,
  status: { type: String, default: 'Pending' },
});

const Project = mongoose.model('Project', projectSchema);
const Delivery = mongoose.model('Delivery', newSchema);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// Route to fetch project statuses
app.get('/projectStatuses', async (req, res) => {
  try {
    const projects = await Delivery.find({});
    res.status(200).json(projects);
  } catch (error) {
    console.error('Error fetching project statuses:', error);
    res.status(500).json({ message: 'Error fetching project statuses', error });
  }
});

// Route to fetch projects
app.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find({}, 'projectTitle uploadDate category fileLink');
    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Route for handling file uploads
app.post('/uploads', upload.single('sourceCodeFile'), async (req, res) => {
  try {
    const { projectTitle, uploadDate, category } = req.body;
    const sourceCodeFileName = req.file.originalname;

    const fileLink = "/uploads/" + sourceCodeFileName;

    const newProject = new Project({
      projectTitle,
      uploadDate,
      category,
      sourceCodeFileName,
      fileLink,
    });

    await newProject.save();

    // Update the status for the specific student's subject in the newSchema
    await Delivery.findOneAndUpdate(
      { category },
      { status: 'Submitted' },
      { new: true }
    );
    

    res.redirect('/student_dashboard.htm');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Serving HTML files
const serveHTMLFile = (route, filename) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, filename));
  });
};

serveHTMLFile('/dashboard.htm', 'dashboard.htm');
serveHTMLFile('/software.htm', 'software.htm');
serveHTMLFile('/hardware.htm', 'hardware.htm');
serveHTMLFile('/login_page.htm', 'login_page.htm');
serveHTMLFile('/student_dashboard.htm', 'student_dashboard.htm');
serveHTMLFile('/upload.htm', 'upload.htm');
serveHTMLFile('/', 'dashboard.htm');
serveHTMLFile('/web_tech.htm', 'web_tech.htm');
serveHTMLFile('/python.htm', 'python.htm');
serveHTMLFile('/IPL.htm', 'IPL.htm');

// Serve uploaded files
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname+'uploads',filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(404).send('File not found');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

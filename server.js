const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session=require('express-session');
const Mongostore=require('connect-mongo');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/sudhanva', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB successfully!');
})
.catch((error) => {
  console.error('Error connecting to MongoDB:', error.message);
});

const projectSchema = new mongoose.Schema({
  projectTitle: String,
  category: String,
  uploadDate: { type: Date, default: Date.now },
  sourceCodeFileName: String,
  fileLink: String
});

const newSchema = new mongoose.Schema({
  // projectTitle: String,
  category: String,
  status: { type: String, default: 'Pending' },
  username: String,
});
// Define the User schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, enum: ['student', 'admin'], required: true }
  // You can add other fields like email, role, etc.
});

// Create the User model
const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const Delivery = mongoose.model('Delivery', newSchema);

app.use(session({
  secret: "SECRETKEY",
  resave: false,
  saveUninitialized: false,
  store: Mongostore.create({
    mongoUrl: 'mongodb://127.0.0.1:27017/sudhanva',
    collectionName:'sessions'
  }),
  cookie:{
    maxAge: 1000*60*60*24
  }
}));
// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Schema Definitions

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
    const updatedDelivery = await Delivery.findOneAndUpdate(
      { category, username: req.session.user.username },
      { status: 'Submitted' },
      { new: true }
    );

    if (!updatedDelivery) {
      return res.status(404).send('Delivery not found');
    }

    // Send the updated status back to the client
    res.json({ success: true, status: updatedDelivery.status });
    

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
  const filePath = path.join(__dirname,'uploads',filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(404).send('File not found');
    }
  });
});

app.post('/login',async(req,res) =>{
  const { username, password, role } = req.body;

  try {
      // Find the user in the database by username
      const user = await User.findOne({ username });

      if (!user) {
          // If the user is not found, send an error response
          return res.status(401).send('Invalid credentials');
      }

      // Compare the provided password with the stored password
      if (user.password !== password) {
          // If the password doesn't match, send an error response
          return res.status(401).send('Invalid credentials');
      }

      // Check if the selected role matches the user's role in the database
      if (user.role !== role) {
          // If the role does not match, send an error response
          return res.status(403).send('Invalid role selected');
      }

      // If credentials and role are valid, save user info and role in session
      req.session.user = { 
          username: user.username,
          role: user.role
      };

      // Redirect to the appropriate dashboard based on role
      if (role === 'admin') {
          res.redirect('/software.htm');
      } else {
          res.redirect('/student_dashboard.htm');
      }
  } catch (error) {
      console.error('Error during login:', error);
      res.status(500).send('Internal Server Error');
  }

})
app.get('/login', (req, res) => {
  if (req.session.user) {
    res.json({ username: req.session.user.username });
  } else {
    res.json({ username: null });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
      if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).send('Internal Server Error');
      }
      res.redirect('/dashboard.htm');
  });
});

app.post('/toggleRole', (req, res) => {
  if (req.session.user) {
      // Toggle the user's role
      req.session.user.role = req.session.user.role === 'student' ? 'admin' : 'student';
      res.send(`Role changed to ${req.session.user.role}`);
  } else {
      res.status(401).send('User not authenticated');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


// to create user
const newuser=new User({
  username: "admin",
  password: "admin",
  role:"admin"
});

newuser.save();

//for session in delivery
// async function createDeliveries() {
//   const deliveries = [
//     { category: 'IPL', status: 'Pending', username: 'venku' },
//     { category: 'Python', status: 'Pending', username: 'venku' },
//     { category: 'Web Tech', status: 'Pending', username: 'venku' },
//     { category: 'IPL', status: 'Pending', username: 'sudhanva' },
//     { category: 'Python', status: 'Pending', username: 'sudhanva' },
//     { category: 'Web Tech', status: 'Pending', username: 'sudhanva' },
//   ];

//   for(const deliverdata of deliveries){
//     const delivery=new Delivery(deliverdata);
//     await delivery.save();
//   }
// }

// createDeliveries();

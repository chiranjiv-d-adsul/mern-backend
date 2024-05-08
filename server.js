const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const modelData = require('./lib/models.js');
const { PDFDocument, rgb } = require('pdf-lib');
const bodyParser = require('body-parser');
const fs = require('fs');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
// const PDFDocument = require('pdfkit');
// const streamBuffers = require('stream-buffers');
require('dotenv').config();


const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
// Refresh token

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });


const filePath = path.join(__dirname, 'TDC.pdf');

async function uploadFile() {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: 'Certificate.pdf',
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body:
          fs.createReadStream(filePath),
      },
    });

    console.log(response.data);
  } catch (error) {
    console.log(error.message);
  }
}

// uploadFile();

async function deletefiles() {
  try {
    const response = await drive.files.delete({
      fileId: '1QZ-flNFmEdQ8k6Lf2QK29CtUEjJmtQ6n'
    });
    console.log(response.data, response.status);
  } catch (error) {
    console.log(error.message);
  }
}
// deletefiles();

// async function generatePublicUrl() {
//   try {
//     const fileId = '1QZ-flNFmEdQ8k6Lf2QK29CtUEjJmtQ6n';
//     const result = await drive.files.get({
//       fileId: fileId,
//       fields: 'webViewLink, webContentLink',
//     });
//     console.log(result.data);
//   } catch (error) {
//     console.log(error.message);
//   }
// }
// generatePublicUrl();
async function generatePublicUrl(fileId) {
  try {
    const result = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink', // Retrieve the webViewLink
    });
    const driveLink = result.data.webViewLink; // Get the webViewLink
    if (!driveLink) {
      throw new Error('webViewLink not found in response');
    }
    return driveLink; // Return the public URL
  } catch (error) {
    console.error('Error generating public URL:', error);
    throw error;
  }
}

async function generatePublicUrl(certificateId) {
  try {
    const fileId = '1QZ-flNFmEdQ8k6Lf2QK29CtUEjJmtQ6n';
    const result = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink, webContentLink',
    });
    const driveLink = result.data.webViewLink; // Assuming you want to use the webViewLink
    console.log(driveLink);
    // Call the function to store the Drive link in the database
    await storeDriveLinkInDB(certificateId, driveLink);
  } catch (error) {
    console.log(error.message);
  }
}

const app = express();
app.use(cors(
  {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,


  }
));
app.use(express.json({ limit: '50mb' })); // Increase payload size limit
app.use(bodyParser.json({ limit: '50mb' }));
const PORT = process.env.PORT || 3000;
// Initialize Multer middleware for file uploads
const upload = multer({ dest: 'uploads/' });




const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
}).then(() => {
  console.log('Connected to MongoDB');
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});
// read data
app.get('/', async (req, res) => {
  const data = await modelData.find({})
  res.json({ sucess: 'true', data : data });
});

// create data // save data
app.post('/create', async (req, res) => {
  const { name, course, date } = req.body;
  const newData = new modelData({ name, course, date });
  await newData.save();
  console.log(req.body);
  res.send({ success: 'true', data: "data save sucessfully" });
});

// update data

app.put('/update/:id', async (req, res) => {
  console.log(req.body);
  const { id } = req.params;

  try {
    const updatedCertificate = await modelData.findByIdAndUpdate(id, req.body, { new: true });
    res.send({ success: true, data: updatedCertificate });
  } catch (error) {
    console.error('Error updating certificate:', error);
    res.status(500).json({ success: false, error: 'Error updating certificate' });
  }
});



// delete data
app.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;
  console.log(id);
  const data = await modelData.deleteOne({ _id: id })
  res.send({ success: 'true', data: "data delete sucessfully", data:data });
});
// Define the route for storing Drive link
// app.post('/store-drive-link', async (req, res) => {
//   const { certificateId, response } = req.body;

//   try {
//     // Find the certificate by ID
//     const certificate = await modelData.findById(certificateId);

//     if (!certificate) {
//       return res.status(404).json({ error: 'Certificate not found' });
//     }

//     // Update the certificate with the Drive link
//     certificate.driveLink = response.data.webViewLink;
//     // Save the updated certificate
//     await certificate.save();

//     console.log('Drive link stored successfully:', certificate.driveLink);

//     res.status(200).json({ message: 'Drive link stored successfully', certificate });
//   } catch (error) {
//     console.error('Error storing Drive link:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
app.post('/store-drive-link', async (req, res) => {
  const { certificateId } = req.body;

  try {
    // Call the function to generate the public URL for the certificate
    const driveLink = await generatePublicUrl(certificateId);

    // Find the certificate by ID
    const certificate = await modelData.findById(certificateId);

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Update the certificate with the Drive link
    certificate.webViewLink = driveLink;

    // Save the updated certificate
    await certificate.save();

    console.log('Drive link stored successfully:', driveLink);

    res.status(200).json({ message: 'Drive link stored successfully', certificate });
  } catch (error) {
    console.error('Error storing Drive link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/generate-certificate', async (req, res) => {
  try {
    const { name, course, date } = req.body;

    // Fetch your certificate template from Google Drive
    const fileId = '1QZ-flNFmEdQ8k6Lf2QK29CtUEjJmtQ6n'; // Replace with the ID of your template file on Google Drive
    const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

    // Check if the response is successful and contains the expected data
    if (response.status !== 200 || !response.data) {
      console.error('Error fetching PDF template:', response.status, response.statusText);
      throw new Error('Failed to fetch PDF template from Google Drive');
    }

    // Load your custom PDF template
    const pdfBytes = await streamToBuffer(response.data);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Modify the PDF template with dynamic content
    const page = pdfDoc.getPage(0);
    const fontSize = 24;
    const textX = 100;
    const textY = 500;

    page.drawText(`Certificate of Completion`, {
      x: textX,
      y: textY,
      size: fontSize,
      color: rgb(0, 0, 0), // black color
    });

    page.drawText(`This is to certify that`, {
      x: textX,
      y: textY - fontSize,
      size: fontSize,
      color: rgb(0, 0, 0),
    });

    page.drawText(`${name}`, {
      x: textX,
      y: textY - 2 * fontSize,
      size: fontSize,
      color: rgb(0, 0, 0),
    });

    page.drawText(`has successfully completed the course`, {
      x: textX,
      y: textY - 3 * fontSize,
      size: fontSize,
      color: rgb(0, 0, 0),
    });

    page.drawText(`${course}`, {
      x: textX,
      y: textY - 4 * fontSize,
      size: fontSize,
      color: rgb(0, 0, 0),
    });

    page.drawText(`on ${date}`, {
      x: textX,
      y: textY - 5 * fontSize,
      size: fontSize,
      color: rgb(0, 0, 0),
    });

    // Save the modified PDF as a buffer
    const modifiedPdfBytes = await pdfDoc.save();

    // Create a new certificate in the database
    const newCertificate = new modelData({ name, course, date });
    await newCertificate.save();

    // Call the function to generate the public URL and store it in the database
    await generatePublicUrl(newCertificate._id); // Use the ID of the newly created certificate

    // Send the generated PDF as a response
    res.contentType('application/pdf');
    res.send(modifiedPdfBytes);
    console.log('Certificate generated successfully');
  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({ success: false, error: 'Error generating certificate' });
  }
});


// app.post('/generate-certificate', async (req, res) => {
//   try {
//     const { name, course, date } = req.body;

//     // Fetch your certificate template from Google Drive
//     const fileId = '1QZ-flNFmEdQ8k6Lf2QK29CtUEjJmtQ6n'; // Replace with the ID of your template file on Google Drive
//     const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

//     // Check if the response is successful and contains the expected data
//     if (response.status !== 200 || !response.data) {
//       console.error('Error fetching PDF template:', response.status, response.statusText);
//       throw new Error('Failed to fetch PDF template from Google Drive');
//     }

//     // Load your custom PDF template
//     const pdfBytes = await streamToBuffer(response.data);
//     const pdfDoc = await PDFDocument.load(pdfBytes);

//     // Modify the PDF template with dynamic content
//     const page = pdfDoc.getPage(0);
//     const fontSize = 24;
//     const textX = 100;
//     const textY = 500;

//     page.drawText(`Certificate of Completion`, {
//       x: textX,
//       y: textY,
//       size: fontSize,
//       color: rgb(0, 0, 0), // black color
//     });

//     page.drawText(`This is to certify that`, {
//       x: textX,
//       y: textY - fontSize,
//       size: fontSize,
//       color: rgb(0, 0, 0),
//     });

//     page.drawText(`${name}`, {
//       x: textX,
//       y: textY - 2 * fontSize,
//       size: fontSize,
//       color: rgb(0, 0, 0),
//     });

//     page.drawText(`has successfully completed the course`, {
//       x: textX,
//       y: textY - 3 * fontSize,
//       size: fontSize,
//       color: rgb(0, 0, 0),
//     });

//     page.drawText(`${course}`, {
//       x: textX,
//       y: textY - 4 * fontSize,
//       size: fontSize,
//       color: rgb(0, 0, 0),
//     });

//     page.drawText(`on ${date}`, {
//       x: textX,
//       y: textY - 5 * fontSize,
//       size: fontSize,
//       color: rgb(0, 0, 0),
//     });

//     // Save the modified PDF as a buffer
//     const modifiedPdfBytes = await pdfDoc.save();
//     // Call the function to generate the public URL and store it in the database
//     await generatePublicUrl(certificate._id); // Assuming certificate._id is the ID of the generated certificate
//     // Send the generated PDF as a response
//     res.contentType('application/pdf');
//     res.send(modifiedPdfBytes);
//     console.log('Certificate generated successfully');
//     console.log(modifiedPdfBytes);
//   } catch (error) {
//     console.error('Error generating certificate:', error);
//     res.status(500).json({ success: false, error: 'Error generating certificate' });
//   }
// });

// Helper function to convert a stream to a buffer
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (error) => reject(error));
  });
}
// Define the storeDriveLinkInDB function outside the route handler
async function storeDriveLinkInDB(certificateId, driveLink) {
  try {
    // Find the certificate by ID
    const certificate = await modelData.findById(certificateId);

    if (!certificate) {
      throw new Error('Certificate not found');
    }

    // Update the certificate with the Drive link
    certificate.driveLink = driveLink;

    // Save the updated certificate
    await certificate.save();

    console.log('Drive link stored successfully:', certificate.driveLink);
  } catch (error) {
    console.error('Error storing Drive link:', error);
    throw error;
  }
}



app.post('/upload-to-drive', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).send('No file uploaded.');
    }

    const response = await drive.files.create({
      requestBody: {
        name: file.originalname, // Use the original file name for the uploaded file
        mimeType: file.mimetype,
      },
      media: {
        mimeType: file.mimetype,
        body: fs.createReadStream(file.path), // Read the file from the provided path
      },
    });

    // Delete the temporary file after uploading
    fs.unlinkSync(file.path);

    console.log('Uploaded to Google Drive:', response.data);
    res.send(response.data);
  } catch (error) {
    console.error('Error uploading to Google Drive:', error.message);
    res.status(500).send('Error uploading to Google Drive.');
  }
});
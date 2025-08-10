const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf-8')
const serviceAccount = JSON.parse(decoded);


// Middleware
app.use(cors());
app.use(express.json());

// Firebase Admin Initialization
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// JWT Middleware
const verifyFireBaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).send({ message: 'Forbidden' });
  }
};

// MongoDB Setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@saif196.fkhluft.mongodb.net/?retryWrites=true&w=majority&appName=saif196`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Main API logic
async function run() {
  try {
    await client.connect();   // it will comment before deploy
    const serviceCollection = client.db("serviceDB").collection("service");
    const bookingsCollection = client.db("serviceDB").collection("servicePost");

    // Test DB Connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Connected to MongoDB!");

   
app.get('/bookings/all', async (req, res) => {
  // No filter, return all bookings for all users
  const bookings = await bookingsCollection.find({}).toArray();
  res.send(bookings);
});


// PUT: Update status of a booking by ID
app.put('/bookings/:id/status', verifyFireBaseToken, async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  if (!status) {
    return res.status(400).send({ message: 'Status is required' });
  }

  // Optional: you can restrict update only if user owns the booking or admin
  // For now, just update

  const result = await bookingsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status } }
  );

  if (result.modifiedCount === 0) {
    return res.status(404).send({ message: 'Booking not found or status unchanged' });
  }

  res.send({ message: 'Status updated successfully' });
});

// DELETE booking by ID
app.delete('/bookings/:id', verifyFireBaseToken, async (req, res) => {
  const id = req.params.id;
  const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    return res.status(404).send({ message: 'Booking not found' });
  }
  res.send({ message: 'Booking deleted' });
});


    // POST: Book a service
app.post('/bookings',async (req, res) => {
  const bookingData = req.body;
  const exists = await bookingsCollection.findOne({ serviceId: bookingData.serviceId, userEmail: bookingData.userEmail });
  if (exists) {
    return res.status(400).json({ message: 'Already booked' });
  }
  const result = await bookingsCollection.insertOne(bookingData);
  res.json(result);
});

// GET: Check booking status for a specific service + user
app.get('/bookings/check/:serviceId', async (req, res) => {
  const { serviceId } = req.params;
  const { email } = req.query; // comes from frontend
  if (!email) return res.status(400).json({ booked: false });

  const booking = await bookingsCollection.findOne({ serviceId, userEmail: email });
  res.json({ booked: !!booking });
});



app.get('/posts', async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ message: 'Email query required' });
  }
  const posts = await bookingsCollection.find({ userEmail: email }).toArray();
  res.send(posts);
});



// DELETE a specific booking/post
app.delete('/posts/:id', async (req, res) => {
  const id = req.params.id;
  const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});





    // POST: Add a new service
    app.post('/service', async (req, res) => {
      const service = req.body;
      const result = await serviceCollection.insertOne(service);
      res.send(result);
    });

    // GET: Get all services for logged-in user
    app.get('/service', verifyFireBaseToken, async (req, res) => {
      const email = req.query.email;

      if (email !== req.user.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const query = { userEmail: email };
      const result = await serviceCollection.find(query).toArray();
      res.send(result);
    });

    // GET: Get single service by ID
    app.get('/service/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });

    // PUT: Update a service (only if user owns it)
    app.put('/service/:id', verifyFireBaseToken, async (req, res) => {
      const id = req.params.id;
      const updatedService = req.body;
      const userEmail = req.user.email;

      const filter = { _id: new ObjectId(id), userEmail };

      const updateDoc = {
        $set: {
          serviceName: updatedService.serviceName,
          description: updatedService.description,
          serviceArea: updatedService.serviceArea,
          price: updatedService.price,
          imageUrl: updatedService.imageUrl,
        },
      };

      const result = await serviceCollection.updateOne(filter, updateDoc);

      if (result.matchedCount === 0) {
        return res.status(403).send({ message: 'Forbidden: Not your service' });
      }

      res.send({ message: 'Service updated', result });
    });

    
    app.delete('/service/:id', verifyFireBaseToken, async (req, res) => {
      const id = req.params.id;
      const userEmail = req.user.email;

      const query = { _id: new ObjectId(id), userEmail };
      const result = await serviceCollection.deleteOne(query);

      if (result.deletedCount === 0) {
        return res.status(403).send({ message: 'Forbidden: Not your service' });
      }

      res.send({ message: 'Service deleted', result });
    });

  } catch (err) {
    console.error('Server Error:', err);
  }
}

run().catch(console.dir);


app.get('/', (req, res) => {
  res.send(' My Server Is Running');
});


app.listen(port, () => {
  console.log(`Server running on:${port}`);
}); 

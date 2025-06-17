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
    // await client.connect();
    const serviceCollection = client.db("serviceDB").collection("service");

    // Test DB Connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Connected to MongoDB!");

   

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

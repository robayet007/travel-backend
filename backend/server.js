import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Initialize
dotenv.config();
const app = express();

const PORT = process.env.PORT || 5000;

// ✅ CLOUDINARY CONFIGURATION
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || '759567457719666',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'doUZk7ZTa3w5SJehy0dwdAPssEM'
});

// ✅ MULTER CLOUDINARY STORAGE
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'travel-packages',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 800, height: 600, crop: 'limit' }]
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// CORS - Allow all origins
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MONGODB URI
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://mohammadrobayet009_db_user:IlrLmx5F6iUVSLRY@cluster0.a9bbtmw.mongodb.net/admin_dashboard?retryWrites=true&w=majority&appName=Cluster0";

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected Successfully!');
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
  connectDB();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

// Product Schema
const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  offerPrice: { type: Number, required: true, min: 0 },
  features: [{ type: String, trim: true }],
  image: { type: String, default: '' },
  cloudinaryId: { type: String, default: '' }
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// Notice Schema
const noticeSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 500
  }
}, { timestamps: true });

const Notice = mongoose.models.Notice || mongoose.model('Notice', noticeSchema);

// Representative Schema
const representativeSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 100
  },
  image: { 
    type: String, 
    default: '' 
  },
  cloudinaryId: { 
    type: String, 
    default: '' 
  },
  facebook: { 
    type: String, 
    trim: true,
    default: '' 
  },
  twitter: { 
    type: String, 
    trim: true,
    default: '' 
  },
  instagram: { 
    type: String, 
    trim: true,
    default: '' 
  }
}, { timestamps: true });

const Representative = mongoose.models.Representative || mongoose.model('Representative', representativeSchema);

// 📊 API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    success: true,
    message: '✅ Server is healthy!',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// Test route
app.get('/test', (req, res) => {
  res.json({ 
    success: true,
    message: '✅ Server is working!',
    timestamp: new Date().toISOString()
  });
});

// ==================== PRODUCT ROUTES ====================

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('❌ Error fetching products:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// Create product with image
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { title, category, price, offerPrice, features } = req.body;

    if (!title || !category || !price || !offerPrice) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required (title, category, price, offerPrice)' 
      });
    }

    // Parse features
    let parsedFeatures = [];
    if (features) {
      try {
        parsedFeatures = typeof features === 'string' ? JSON.parse(features) : features;
      } catch (e) {
        parsedFeatures = Array.isArray(features) ? features : [features];
      }
    }

    const newProduct = new Product({
      title: title.trim(),
      category: category.trim(),
      price: Number(price),
      offerPrice: Number(offerPrice),
      features: parsedFeatures,
      image: req.file ? req.file.path : '',
      cloudinaryId: req.file ? req.file.filename : ''
    });

    const savedProduct = await newProduct.save();
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully!',
      data: savedProduct
    });

  } catch (error) {
    console.error('❌ Error creating product:', error.message);
    res.status(400).json({ 
      success: false, 
      message: 'Failed to create product',
      error: error.message 
    });
  }
});

// Update product with image
app.put('/api/products/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, price, offerPrice, features } = req.body;

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Parse features
    let parsedFeatures = existingProduct.features;
    if (features) {
      try {
        parsedFeatures = typeof features === 'string' ? JSON.parse(features) : features;
      } catch (e) {
        parsedFeatures = Array.isArray(features) ? features : [features];
      }
    }

    // Update data
    const updateData = {
      title: title || existingProduct.title,
      category: category || existingProduct.category,
      price: price ? Number(price) : existingProduct.price,
      offerPrice: offerPrice ? Number(offerPrice) : existingProduct.offerPrice,
      features: parsedFeatures
    };

    // If new image uploaded
    if (req.file) {
      // Delete old image from Cloudinary
      if (existingProduct.cloudinaryId) {
        try {
          await cloudinary.uploader.destroy(existingProduct.cloudinaryId);
          console.log('✅ Old image deleted from Cloudinary');
        } catch (error) {
          console.log('⚠️ Failed to delete old image:', error.message);
        }
      }
      
      updateData.image = req.file.path;
      updateData.cloudinaryId = req.file.filename;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });

  } catch (error) {
    console.error('❌ Error updating product:', error.message);
    res.status(400).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete image from Cloudinary
    if (product.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(product.cloudinaryId);
        console.log('✅ Image deleted from Cloudinary');
      } catch (error) {
        console.log('⚠️ Failed to delete image:', error.message);
      }
    }

    await Product.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: product
    });

  } catch (error) {
    console.error('❌ Error deleting product:', error.message);
    res.status(400).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
});

// ==================== NOTICE ROUTES ====================

// Get all notices
app.get('/api/notices', async (req, res) => {
  try {
    const notices = await Notice.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: notices.length,
      data: notices
    });
  } catch (error) {
    console.error('❌ Error fetching notices:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notices',
      error: error.message
    });
  }
});

// Create notice
app.post('/api/notices', async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Title is required' 
      });
    }

    const newNotice = new Notice({
      title: title.trim()
    });

    const savedNotice = await newNotice.save();
    
    res.status(201).json({
      success: true,
      message: 'Notice created successfully!',
      data: savedNotice
    });

  } catch (error) {
    console.error('❌ Error creating notice:', error.message);
    res.status(400).json({ 
      success: false, 
      message: 'Failed to create notice',
      error: error.message 
    });
  }
});

// Update notice
app.put('/api/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Title is required' 
      });
    }

    const updatedNotice = await Notice.findByIdAndUpdate(
      id,
      { title: title.trim() },
      { new: true, runValidators: true }
    );

    if (!updatedNotice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    res.json({
      success: true,
      message: 'Notice updated successfully',
      data: updatedNotice
    });

  } catch (error) {
    console.error('❌ Error updating notice:', error.message);
    res.status(400).json({
      success: false,
      message: 'Failed to update notice',
      error: error.message
    });
  }
});

// Delete notice
app.delete('/api/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findByIdAndDelete(id);

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    res.json({
      success: true,
      message: 'Notice deleted successfully',
      data: notice
    });

  } catch (error) {
    console.error('❌ Error deleting notice:', error.message);
    res.status(400).json({
      success: false,
      message: 'Failed to delete notice',
      error: error.message
    });
  }
});

// ==================== REPRESENTATIVE ROUTES ====================

// Get all representatives
app.get('/api/representatives', async (req, res) => {
  try {
    const representatives = await Representative.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: representatives.length,
      data: representatives
    });
  } catch (error) {
    console.error('❌ Error fetching representatives:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch representatives',
      error: error.message
    });
  }
});

// Create representative with image
// Create representative WITH JSON (without image upload)
app.post('/api/representatives', async (req, res) => {
  try {
    const { name, facebook, twitter, instagram } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Name is required' 
      });
    }

    const newRepresentative = new Representative({
      name: name.trim(),
      facebook: facebook || '',
      twitter: twitter || '',
      instagram: instagram || '',
      image: '', // Empty since no image
      cloudinaryId: '' // Empty
    });

    const savedRepresentative = await newRepresentative.save();
    
    res.status(201).json({
      success: true,
      message: 'Representative created successfully!',
      data: savedRepresentative
    });

  } catch (error) {
    console.error('❌ Error creating representative:', error.message);
    res.status(400).json({ 
      success: false, 
      message: 'Failed to create representative',
      error: error.message 
    });
  }
});

// Create representative WITH image (form-data) - আলাদা route
app.post('/api/representatives/with-image', upload.single('image'), async (req, res) => {
  try {
    const { name, facebook, twitter, instagram } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Name is required' 
      });
    }

    const newRepresentative = new Representative({
      name: name.trim(),
      facebook: facebook || '',
      twitter: twitter || '',
      instagram: instagram || '',
      image: req.file ? req.file.path : '',
      cloudinaryId: req.file ? req.file.filename : ''
    });

    const savedRepresentative = await newRepresentative.save();
    
    res.status(201).json({
      success: true,
      message: 'Representative created successfully!',
      data: savedRepresentative
    });

  } catch (error) {
    console.error('❌ Error creating representative:', error.message);
    res.status(400).json({ 
      success: false, 
      message: 'Failed to create representative',
      error: error.message 
    });
  }
});

// Update representative with image
app.put('/api/representatives/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, facebook, twitter, instagram } = req.body;

    const existingRepresentative = await Representative.findById(id);
    if (!existingRepresentative) {
      return res.status(404).json({
        success: false,
        message: 'Representative not found'
      });
    }

    // Update data
    const updateData = {
      name: name || existingRepresentative.name,
      facebook: facebook || existingRepresentative.facebook,
      twitter: twitter || existingRepresentative.twitter,
      instagram: instagram || existingRepresentative.instagram
    };

    // If new image uploaded
    if (req.file) {
      // Delete old image from Cloudinary
      if (existingRepresentative.cloudinaryId) {
        try {
          await cloudinary.uploader.destroy(existingRepresentative.cloudinaryId);
          console.log('✅ Old image deleted from Cloudinary');
        } catch (error) {
          console.log('⚠️ Failed to delete old image:', error.message);
        }
      }
      
      updateData.image = req.file.path;
      updateData.cloudinaryId = req.file.filename;
    }

    const updatedRepresentative = await Representative.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Representative updated successfully',
      data: updatedRepresentative
    });

  } catch (error) {
    console.error('❌ Error updating representative:', error.message);
    res.status(400).json({
      success: false,
      message: 'Failed to update representative',
      error: error.message
    });
  }
});

// Delete representative
app.delete('/api/representatives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const representative = await Representative.findById(id);

    if (!representative) {
      return res.status(404).json({
        success: false,
        message: 'Representative not found'
      });
    }

    // Delete image from Cloudinary
    if (representative.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(representative.cloudinaryId);
        console.log('✅ Image deleted from Cloudinary');
      } catch (error) {
        console.log('⚠️ Failed to delete image:', error.message);
      }
    }

    await Representative.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Representative deleted successfully',
      data: representative
    });

  } catch (error) {
    console.error('❌ Error deleting representative:', error.message);
    res.status(400).json({
      success: false,
      message: 'Failed to delete representative',
      error: error.message
    });
  }
});

// MongoDB Status
app.get('/mongodb-status', (req, res) => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };

  res.json({
    success: true,
    connected: state === 1,
    connectionState: states[state],
    message: state === 1 ? '✅ MongoDB Connected' : '❌ MongoDB Disconnected'
  });
});

// Home route
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: '🛍️ Travel Admin API with Cloudinary is running on Render!',
    mongodb: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected',
    endpoints: {
      health: 'GET /health',
      test: 'GET /test',
      mongodbStatus: 'GET /mongodb-status',
      // Product endpoints
      getAllProducts: 'GET /api/products',
      createProduct: 'POST /api/products',
      updateProduct: 'PUT /api/products/:id',
      deleteProduct: 'DELETE /api/products/:id',
      // Notice endpoints
      getAllNotices: 'GET /api/notices',
      createNotice: 'POST /api/notices',
      updateNotice: 'PUT /api/notices/:id',
      deleteNotice: 'DELETE /api/notices/:id',
      // Representative endpoints
      getAllRepresentatives: 'GET /api/representatives',
      createRepresentative: 'POST /api/representatives',
      updateRepresentative: 'PUT /api/representatives/:id',
      deleteRepresentative: 'DELETE /api/representatives/:id'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
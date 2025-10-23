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
      getAllProducts: 'GET /api/products',
      createProduct: 'POST /api/products',
      updateProduct: 'PUT /api/products/:id',
      deleteProduct: 'DELETE /api/products/:id'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
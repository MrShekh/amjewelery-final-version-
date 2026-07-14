# 🏆 Gold Billing ERP System - AM Jewellers

A comprehensive jewelry manufacturing and billing management system built with Next.js, TypeScript, and MongoDB.

## 📋 Features

### 🏭 Manufacturing Management
- **Order Management**: Create, track, and manage jewelry orders
- **Process Tracking**: Multi-step manufacturing process management
- **Karigar Management**: Track workers and their contributions
- **Gold Loss & Recovery**: Detailed tracking of gold usage and losses

### 💰 Financial Management
- **Jama Gold System**: Track customer gold debts and collections
- **Advance Gold Management**: Handle customer-provided gold
- **Billing & Invoicing**: Comprehensive billing with PDF export
- **Inventory Management**: Multi-karat gold stock management

### 👥 Customer Management
- **Customer Profiles**: Detailed customer information management
- **Order History**: Complete order tracking per customer
- **Payment Tracking**: Monitor payments and outstanding amounts

### 🔐 Security & Authentication
- **JWT Authentication**: Secure user authentication
- **Role-based Access**: Different access levels for users
- **Session Management**: Secure session handling

## 🚀 Technology Stack

- **Frontend**: Next.js 15.4.6 with TypeScript
- **Backend**: Next.js API Routes
- **Database**: MongoDB with optimized indexing
- **Authentication**: JWT with bcryptjs
- **File Upload**: Cloudinary integration
- **Styling**: Tailwind CSS
- **PDF Generation**: Multiple PDF libraries for invoicing

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account or local MongoDB
- Cloudinary account (for image uploads)

### Environment Variables

Create `.env.local` file with:

```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### Installation Steps

```bash
# Clone the repository
git clone <repository-url>
cd gold-billing-system

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🏗️ Database Collections

The system uses the following MongoDB collections:

- **customers**: Customer information and profiles
- **orders**: Jewelry orders with status tracking
- **manufacturing_processes**: Manufacturing step details
- **karigars**: Worker/craftsman information
- **customerJamaBalances**: Customer gold debt tracking
- **inventory**: Multi-karat gold stock management
- **customerBills**: Billing and invoice records
- **users**: System user authentication
- **gold_transactions**: Gold movement tracking

## 📱 Usage

### 1. User Management
- Create admin users through the authentication system
- Login with email/password credentials
- JWT tokens for secure session management

### 2. Customer Management
- Add new customers with contact details
- View customer order history
- Track customer gold balances (jama gold)
- Manage advance gold provided by customers

### 3. Order Management
- Create new jewelry orders with specifications
- Upload order images via Cloudinary
- Track manufacturing progress through multiple stages
- Assign karigars (craftsmen) to different processes

### 4. Manufacturing Process
- Define multi-step manufacturing workflows
- Track gold input/output at each stage
- Calculate and monitor gold losses
- Record recovery amounts from processes

### 5. Financial Tracking
- **Jama Gold**: Track gold owed by customers
- **Collections**: Process gold returns from customers
- **Billing**: Generate comprehensive bills
- **PDF Export**: Create professional invoices

### 6. Inventory Management
- Track gold stock by karat (92%, 75.5%, 80%)
- Monitor stock levels across different categories
- Track customer stock vs admin stock
- Real-time inventory updates

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Customers
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `GET /api/customers/[id]` - Get customer details
- `PUT /api/customers/[id]` - Update customer

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/orders/[id]` - Get order details
- `PUT /api/orders/[id]` - Update order

### Jama Gold Management
- `POST /api/customers/[id]/jama-gold` - Add jama gold entry
- `PUT /api/customers/[id]/jama-gold` - Process gold return
- `POST /api/customers/[id]/jama-gold/[jamaId]` - Collect specific balance
- `PUT /api/customers/[id]/jama-gold/[jamaId]` - Update balance
- `DELETE /api/customers/[id]/jama-gold/[jamaId]` - Delete balance

### Manufacturing
- `GET /api/orders/[id]/processes` - Get order processes
- `POST /api/orders/[id]/processes/start` - Start process
- `POST /api/orders/[id]/processes/complete` - Complete process

### Billing
- `GET /api/orders/[id]/bill` - Get bill details
- `GET /api/bills/[id]/pdf` - Generate PDF bill

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Connect Repository**
   - Link your GitHub repository to Vercel

2. **Environment Variables**
   Set in Vercel Dashboard:
   ```bash
   MONGODB_URI=your-mongodb-atlas-connection
   JWT_SECRET=your-production-jwt-secret
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   NODE_ENV=production
   ```

3. **Deploy**
   - Vercel will automatically build and deploy
   - Custom domain can be configured

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🛡️ Security Features

- **JWT Authentication** with secure token handling
- **Password Hashing** using bcryptjs
- **Input Validation** on all API endpoints
- **Error Handling** with sanitized error messages
- **CORS Configuration** for API security
- **Request Rate Limiting** (configurable)

## 📊 Key Business Flows

### 1. Order Creation Flow
1. Customer places order with specifications
2. Order created with initial gold requirements
3. Manufacturing processes defined and assigned
4. Progress tracked through completion
5. Final billing and delivery

### 2. Jama Gold Management Flow
1. Customer owes gold after order completion
2. Jama gold balance created
3. Customer returns gold over time
4. Individual balance collections processed
5. Stock transfers (Customer → Admin)

### 3. Manufacturing Process Flow
1. Raw materials assigned to order
2. Multi-step processes with karigar assignment
3. Gold loss/recovery tracking at each step
4. Quality control and completion verification
5. Final weight and cost calculations

## 🔧 Configuration

### Image Upload Configuration
```javascript
// Cloudinary settings in next.config.js
images: {
  domains: ['res.cloudinary.com', 'cloudinary.com'],
  unoptimized: process.env.NODE_ENV === 'development'
}
```

### Database Optimization
- Indexed collections for performance
- Aggregation pipelines for complex queries
- Connection pooling for scalability

## 📈 Performance Optimizations

- **Next.js App Router** for optimized routing
- **Server-side Rendering** for better SEO
- **Image Optimization** via Cloudinary
- **Database Indexing** for faster queries
- **Caching Strategies** for frequently accessed data

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MONGODB_URI format
   - Verify network access in MongoDB Atlas
   - Ensure IP whitelist includes deployment server

2. **Image Upload Issues**
   - Verify Cloudinary credentials
   - Check file size limits
   - Ensure proper CORS configuration

3. **JWT Token Issues**
   - Verify JWT_SECRET is set
   - Check token expiration settings
   - Clear browser storage for fresh session

4. **Build Errors**
   - Run `npm run build` locally first
   - Check TypeScript errors
   - Verify all dependencies are installed

## 📞 Support

For technical support or feature requests:
- Check the error logs in production
- Review API response codes and messages
- Ensure all environment variables are properly set
- Monitor database connection status

## 📄 License

This project is proprietary software for AM Jewellers.

---

**Production Ready Features:**
- ✅ TypeScript for type safety
- ✅ Comprehensive error handling
- ✅ Production-optimized build
- ✅ Security best practices
- ✅ Database optimization
- ✅ Scalable architecture
- ✅ Professional PDF generation
- ✅ Real-time inventory management
- ✅ Multi-user authentication system

**System Status:** Ready for production deployment 🚀

# URL Shortener Backend

A scalable URL shortener service built with Node.js, TypeScript, Prisma, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites

- Node.js 18.x or higher
- PostgreSQL 12.x or higher
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd url-shortener/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   Update the `.env` file with your database credentials and other configuration.

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Seed the database (optional)
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## 📁 Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Custom middleware
├── routes/          # API routes
├── services/        # Business logic
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── index.ts         # Application entry point
```

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed the database
- `npm run db:studio` - Open Prisma Studio

## 🌐 API Endpoints

### Health Check
- `GET /health` - Check service health

### URL Management
- `POST /api/v1/urls` - Create short URL
- `GET /api/v1/urls` - List URLs (paginated)
- `GET /api/v1/urls/:shortCode` - Get URL details
- `DELETE /api/v1/urls/:shortCode` - Delete URL
- `GET /:shortCode` - Redirect to original URL

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login

## 🔒 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |
| `JWT_SECRET` | JWT signing secret | Required |
| `BASE_URL` | Base URL for short links | http://localhost:3000 |
| `CORS_ORIGIN` | CORS allowed origin | http://localhost:3001 |

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## 📊 Database Schema

The application uses PostgreSQL with Prisma ORM. Key models:

- **User** - User accounts
- **Url** - Shortened URLs
- **Analytics** - Click tracking data
- **ApiKey** - API key management

## 🔄 Development Workflow

1. **Create a new feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test**
   ```bash
   npm run test
   npm run lint
   ```

3. **Build and verify**
   ```bash
   npm run build
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add your feature"
   git push origin feature/your-feature-name
   ```

## 🏗️ Architecture

### MVP Features
- ✅ URL shortening with custom codes
- ✅ URL redirection
- ✅ Basic analytics (click counting)
- ✅ Rate limiting
- ✅ Error handling and logging

### Planned Features
- [ ] User authentication
- [ ] Advanced analytics
- [ ] Custom domains
- [ ] Bulk operations
- [ ] QR code generation
- [ ] Link expiration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run the test suite
6. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

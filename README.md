# BookMyArena

A web-based platform for booking sports arenas online. BookMyArena provides real-time availability, multi-arena support, and centralized management for stadium owners.

## Features

- **User Registration & Authentication**: Secure signup/login with stateful sessions
- **Role-Based Access**: Separate dashboards for Owners and Users
- **Stadium Management**: Owners can add stadiums and arenas
- **Arena Booking**: Users can search and book arena slots
- **Real-time Availability**: Check slot availability before booking
- **Booking Management**: View, cancel, and manage bookings
- **Search & Filters**: Filter arenas by location, sport type, and date

## Technology Stack

- **Backend**: Go (Golang) with net/http and gorilla/mux
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Database**: SQL Server
- **Authentication**: Stateful sessions with bcrypt password hashing

## Project Structure

```
BookMyArena/
├── backend/
│   ├── config/
│   │   ├── database.go
│   │   └── database_init.sql
│   ├── controllers/
│   │   ├── userController.go
│   │   ├── stadiumController.go
│   │   ├── arenaController.go
│   │   └── bookingController.go
│   ├── middleware/
│   │   └── auth.go
│   ├── models/
│   │   ├── user.go
│   │   ├── stadium.go
│   │   ├── arena.go
│   │   ├── booking.go
│   │   └── session.go
│   ├── routes/
│   │   └── routes.go
│   └── services/
│       ├── authService.go
│       ├── stadiumService.go
│       ├── arenaService.go
│       └── bookingService.go
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   └── booking.js
│   └── pages/
│       ├── signup.html
│       ├── login.html
│       ├── dashboard.html
│       └── search.html
├── main.go
├── go.mod
└── README.md
```

## Prerequisites

- Go 1.21 or higher
- SQL Server (local or remote)
- Git (optional)

## Setup Instructions

### 1. Database Setup

1. Open SQL Server Management Studio (SSMS) or use sqlcmd
2. Create the database (if it doesn't exist):
   ```sql
   CREATE DATABASE BookMyArena;
   ```
3. Run the initialization script:
   ```sql
   USE BookMyArena;
   GO
   -- Then run the contents of backend/config/database_init.sql
   ```
   Or execute the SQL file directly using SSMS or sqlcmd.

### 2. Backend Setup

1. Navigate to the project directory:
   ```bash
   cd BookMyArena
   ```

2. Install dependencies:
   ```bash
   go mod download
   ```

3. Set database connection string (optional):
   ```bash
   # Windows PowerShell
   $env:DB_CONNECTION_STRING="server=localhost;user id=sa;password=YourPassword;database=BookMyArena;encrypt=disable"
   
   # Windows CMD
   set DB_CONNECTION_STRING=server=localhost;user id=sa;password=YourPassword;database=BookMyArena;encrypt=disable
   
   # Linux/Mac
   export DB_CONNECTION_STRING="server=localhost;user id=sa;password=YourPassword;database=BookMyArena;encrypt=disable"
   ```

   If not set, the default connection string will be used:
   `server=localhost;user id=sa;password=YourPassword123;database=BookMyArena;encrypt=disable`

4. Run the server:
   ```bash
   go run main.go
   ```

   The server will start on `http://localhost:8080`

### 3. Access the Application

Open your browser and navigate to:
- Home: `http://localhost:8080`
- Signup: `http://localhost:8080/frontend/pages/signup.html`
- Login: `http://localhost:8080/frontend/pages/login.html`

## API Endpoints

### Authentication
- `POST /api/signup` - Create new user account
- `POST /api/login` - Login and create session
- `GET /api/logout` - Logout and destroy session
- `GET /api/user` - Get current user info

### Stadiums (Owner only)
- `POST /api/stadiums` - Create stadium
- `GET /api/stadiums` - List stadiums (owner's stadiums if owner, all if user)
- `GET /api/stadiums/{id}` - Get stadium details

### Arenas
- `POST /api/arenas` - Create arena (Owner only)
- `GET /api/arenas/{id}` - Get arena details (with optional `?date=YYYY-MM-DD` for slot availability)
- `GET /api/arenas/search` - Search arenas (query params: `location`, `sportType`, `date`)
- `GET /api/stadiums/{stadiumId}/arenas` - Get arenas by stadium

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - List bookings (user's bookings or owner's bookings)
- `PUT /api/bookings/{id}/cancel` - Cancel booking
- `PUT /api/bookings/{id}/status` - Update booking status (Owner only)

## Usage

### For Owners

1. Sign up with role "Owner"
2. Login to access owner dashboard
3. Add stadiums with name and location
4. Add arenas to stadiums with sport type, capacity, slot duration, and price
5. View and manage bookings (confirm/reject pending bookings)

### For Users

1. Sign up with role "User"
2. Login to access user dashboard
3. Search for arenas using location, sport type, and date filters
4. Book available slots
5. View and cancel your bookings

## Security Features

- Password hashing using bcrypt
- Stateful session management
- SQL injection prevention with parameterized queries
- CORS support for API access
- Input validation on both frontend and backend

## Development Notes

- All API endpoints return JSON responses
- Error responses follow format: `{"error": "error message"}`
- Session tokens are stored in cookies (session_token) and can also be sent via Authorization header as Bearer token
- Sessions expire after 24 hours
- Expired sessions are cleaned up automatically every hour

## Troubleshooting

### Database Connection Issues

- Verify SQL Server is running
- Check connection string format and credentials
- Ensure database exists and is accessible
- Try `encrypt=disable` if using local SQL Server

### Port Already in Use

- Change the port in `main.go` if 8080 is occupied
- Or stop the application using port 8080

### Module Dependencies

- Run `go mod tidy` to clean up dependencies
- Run `go mod download` to download missing packages

## License

This project is for educational purposes.

## Future Enhancements

- Email notifications for bookings
- Payment integration
- Analytics dashboard with charts
- Admin panel for platform-wide management
- Real-time updates using WebSockets


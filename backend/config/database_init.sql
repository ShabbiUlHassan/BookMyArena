-- Create Database (run this separately if database doesn't exist)
-- CREATE DATABASE BookMyArena;

USE BookMyArena;
GO

-- Users Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
CREATE TABLE Users (
    UserId INT PRIMARY KEY IDENTITY(1,1),
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    Role NVARCHAR(50) NOT NULL CHECK (Role IN ('Owner', 'User')),
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
);
GO

-- Stadiums Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Stadiums' AND xtype='U')
CREATE TABLE Stadiums (
    StadiumId INT PRIMARY KEY IDENTITY(1,1),
    OwnerId INT NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Location NVARCHAR(255) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (OwnerId) REFERENCES Users(UserId) ON DELETE CASCADE
);
GO

-- Arenas Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Arenas' AND xtype='U')
CREATE TABLE Arenas (
    ArenaId INT PRIMARY KEY IDENTITY(1,1),
    StadiumId INT NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    SportType NVARCHAR(50) NOT NULL,
    Capacity INT NOT NULL,
    SlotDuration INT NOT NULL,
    Price DECIMAL(10,2) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (StadiumId) REFERENCES Stadiums(StadiumId) ON DELETE CASCADE
);
GO

-- Bookings Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Bookings' AND xtype='U')
CREATE TABLE Bookings (
    BookingId INT PRIMARY KEY IDENTITY(1,1),
    UserId INT NOT NULL,
    ArenaId INT NOT NULL,
    SlotStart DATETIME NOT NULL,
    SlotEnd DATETIME NOT NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (Status IN ('Pending', 'Confirmed', 'Cancelled')),
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    FOREIGN KEY (ArenaId) REFERENCES Arenas(ArenaId) ON DELETE CASCADE
);
GO

-- Sessions Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Sessions' AND xtype='U')
CREATE TABLE Sessions (
    SessionId INT PRIMARY KEY IDENTITY(1,1),
    UserId INT NOT NULL,
    Token NVARCHAR(255) UNIQUE NOT NULL,
    ExpiresAt DATETIME NOT NULL,
    FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE
);
GO

-- BookingRequest Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BookingRequest' AND xtype='U')
CREATE TABLE BookingRequest (
    BookingRequestId INT PRIMARY KEY IDENTITY(1,1),
    BookieID INT NOT NULL,
    OwnersId INT NOT NULL,
    ArenaID INT NOT NULL,
    Price DECIMAL(10, 2) NOT NULL,
    RStatus VARCHAR(50) NOT NULL DEFAULT 'Pending',
    CreatedBy INT NOT NULL,
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    IsDeleted BIT NOT NULL DEFAULT 0,
    AvailabilityId UNIQUEIDENTIFIER NOT NULL,
    FOREIGN KEY (BookieID) REFERENCES Users(UserId) ON DELETE CASCADE,
    FOREIGN KEY (OwnersId) REFERENCES Users(UserId) ON DELETE CASCADE,
    FOREIGN KEY (ArenaID) REFERENCES Arenas(ArenaId) ON DELETE CASCADE,
    FOREIGN KEY (CreatedBy) REFERENCES Users(UserId) ON DELETE NO ACTION,
    FOREIGN KEY (AvailabilityId) REFERENCES ArenaAvailability(Id) ON DELETE CASCADE
);
GO

-- Indexes for better performance
CREATE INDEX IX_Stadiums_OwnerId ON Stadiums(OwnerId);
CREATE INDEX IX_Arenas_StadiumId ON Arenas(StadiumId);
CREATE INDEX IX_Bookings_UserId ON Bookings(UserId);
CREATE INDEX IX_Bookings_ArenaId ON Bookings(ArenaId);
CREATE INDEX IX_Bookings_SlotStart_SlotEnd ON Bookings(SlotStart, SlotEnd);
CREATE INDEX IX_Sessions_Token ON Sessions(Token);
CREATE INDEX IX_Sessions_ExpiresAt ON Sessions(ExpiresAt);
CREATE INDEX IX_BookingRequest_BookieID ON BookingRequest(BookieID);
CREATE INDEX IX_BookingRequest_OwnersId ON BookingRequest(OwnersId);
CREATE INDEX IX_BookingRequest_ArenaID ON BookingRequest(ArenaID);
CREATE INDEX IX_BookingRequest_AvailabilityId ON BookingRequest(AvailabilityId);
CREATE INDEX IX_BookingRequest_RStatus ON BookingRequest(RStatus);
CREATE INDEX IX_BookingRequest_IsDeleted ON BookingRequest(IsDeleted);
GO


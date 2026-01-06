-- Migration: Add IsDeletedUser and IsDeletedOwner columns to BookingRequest table
-- This allows soft delete functionality where users and owners can hide booking requests from their view

USE BookMyArena;
GO

-- Add IsDeletedUser column if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BookingRequest') AND name = 'IsDeletedUser')
BEGIN
    ALTER TABLE BookingRequest
    ADD IsDeletedUser BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsDeletedUser column to BookingRequest table';
END
ELSE
BEGIN
    PRINT 'IsDeletedUser column already exists in BookingRequest table';
END
GO

-- Add IsDeletedOwner column if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BookingRequest') AND name = 'IsDeletedOwner')
BEGIN
    ALTER TABLE BookingRequest
    ADD IsDeletedOwner BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsDeletedOwner column to BookingRequest table';
END
ELSE
BEGIN
    PRINT 'IsDeletedOwner column already exists in BookingRequest table';
END
GO

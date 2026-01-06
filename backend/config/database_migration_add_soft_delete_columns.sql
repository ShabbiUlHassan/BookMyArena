

USE BookMyArena;
GO

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

-- Safe to run again: existing student records and accounts are preserved.
IF OBJECT_ID('dbo.Students', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Students (
        StudentId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Email NVARCHAR(100) NOT NULL UNIQUE,
        Phone NVARCHAR(20) NOT NULL,
        Department NVARCHAR(50) NOT NULL,
        CreatedDate DATETIME NOT NULL DEFAULT GETUTCDATE()
    );
END;

-- These two tables support the requested login page.
IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        UserId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Email NVARCHAR(100) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(255) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID('dbo.Sessions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Sessions (
        TokenHash CHAR(64) NOT NULL PRIMARY KEY,
        UserId INT NOT NULL REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ExpiresAt DATETIME2 NOT NULL
    );
    CREATE INDEX IX_Sessions_ExpiresAt ON dbo.Sessions(ExpiresAt);
END;

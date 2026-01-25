# API Documentation

Base URL: `http://localhost:3000`

---

## Authentication Endpoints

### 1. Register User
**POST** `/api/auth/register`

Creates a new user account.

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "yourSecurePassword123"
}
```

**Success Response (201 Created):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "fullName": "John Doe",
  "email": "john@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- **400 Bad Request** - Missing fields
  ```json
  {
    "message": "Please add all fields"
  }
  ```
- **400 Bad Request** - User already exists
  ```json
  {
    "message": "User already exists"
  }
  ```

---

### 2. Login User
**POST** `/api/auth/login`

Authenticates a user and returns a JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "yourSecurePassword123"
}
```

**Success Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "fullName": "John Doe",
  "email": "john@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response:**
- **401 Unauthorized** - Invalid credentials
  ```json
  {
    "message": "Invalid credentials"
  }
  ```

---

### 3. Get Current User
**GET** `/api/auth/me`

Retrieves the currently authenticated user's information.

**Headers Required:**
```
Authorization: Bearer <your_jwt_token>
```

**Success Response (200 OK):**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "fullName": "John Doe",
  "email": "john@example.com"
}
```

**Error Responses:**
- **401 Unauthorized** - No token or invalid token
  ```json
  {
    "message": "Not authorized, no token"
  }
  ```
- **404 Not Found** - User not found
  ```json
  {
    "message": "User not found"
  }
  ```

---

### 4. Forgot Password (Request OTP)
**POST** `/api/auth/forgot-password`

Sends a 6-digit OTP to the user's email for password reset verification.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Success Response (200 OK):**
```json
{
  "message": "If an account exists with that email, an OTP has been sent."
}
```

---

### 5. Verify OTP
**POST** `/api/auth/verify-otp`

Verifies the 6-digit OTP sent to the email and returns a temporary reset token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

**Success Response (200 OK):**
```json
{
  "message": "OTP verified successfully",
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response:**
- **400 Bad Request** - Invalid or expired OTP
  ```json
  {
    "message": "Invalid or expired OTP"
  }
  ```

---

### 6. Reset Password
**POST** `/api/auth/reset-password`

Resets the user's password using the temporary reset token obtained from OTP verification.

**Request Body:**
```json
{
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "newSecurePassword123"
}
```

**Success Response (200 OK):**
```json
{
  "message": "Password reset successfully"
  }
```

**Error Response:**
- **400 Bad Request** - Invalid or expired reset token
  ```json
  {
    "message": "Invalid or expired reset token"
  }
  ```

---

## Testing with cURL

### Register a new user:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get current user (replace YOUR_TOKEN):
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Request Password Reset OTP:
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

### Verify OTP:
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "otp": "123456"
  }'
```

### Reset Password:
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "resetToken": "YOUR_RESET_TOKEN",
    "newPassword": "newpassword123"
  }'
```

---

## Testing with Postman

1. **Import as Collection** - Save the endpoints above
2. **Set Environment Variables:**
   - `baseUrl`: `http://localhost:3000`
   - `token`: (set after login/register)

3. **For Protected Routes:**
   - Go to **Authorization** tab
   - Select **Bearer Token**
   - Use the token received from login/register

---

## Token Information

- **Token Type:** JWT (JSON Web Token)
- **Token Expiry:** 30 days
- **Token Location:** Include in Authorization header as: `Bearer <token>`
- **Token Contents:** User ID

---

## Common Error Codes

| Status Code | Meaning |
|------------|---------|
| 200 | Success - Request completed successfully |
| 201 | Created - New resource created successfully |
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Authentication required or failed |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error - Internal server error |

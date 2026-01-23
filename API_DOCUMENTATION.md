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

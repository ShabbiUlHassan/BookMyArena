# Troubleshooting: Arenas Not Showing

If users cannot see available arenas, check the following:

## 1. Check Browser Console
Open the browser developer tools (F12) and check the Console tab for any JavaScript errors or network errors.

## 2. Verify User is Logged In
The `/api/arenas` endpoint requires authentication. Make sure:
- User has successfully logged in
- Session token is stored (check browser cookies for `session_token`)
- User is redirected to search page after login

## 3. Check Network Requests
In browser developer tools, go to the Network tab and:
- Look for a request to `/api/arenas` (GET method)
- Check the response status code (should be 200)
- Check the response body (should be a JSON array of arenas)

## 4. Verify Database Has Data
Make sure there are arenas in the database:
- Connect to SQL Server
- Run: `SELECT * FROM Arenas`
- Verify there are arena records
- Also check that stadiums exist: `SELECT * FROM Stadiums`

## 5. Test API Directly
You can test the API endpoint directly using curl or Postman:

```bash
# Replace YOUR_TOKEN with actual session token from browser
curl -X GET http://localhost:8080/api/arenas \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Cookie: session_token=YOUR_TOKEN"
```

## 6. Check Server Logs
Check the Go server console output for any errors when the request is made.

## 7. Common Issues

### Empty Database
If the database is empty, the page will show "No arenas found". To fix:
1. Log in as an Owner
2. Add a stadium
3. Add arenas to that stadium
4. Log in as a User and check the search page

### Authentication Error
If you see "unauthorized" errors:
1. Make sure you're logged in
2. Try logging out and logging back in
3. Check that cookies are enabled in your browser

### CORS Issues
If you see CORS errors, the server's CORS middleware should handle this, but verify the server is running on the expected port (8080).

## Debug Steps

1. Open search.html in browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Look for:
   - "Loading arenas..." message
   - "Loaded arenas:" log with data
   - Any error messages

5. Go to Network tab
6. Refresh the page
7. Find the request to `/api/arenas`
8. Check:
   - Status code (200 = success)
   - Response tab (should show JSON array)
   - Request headers (should include Authorization or Cookie)

If all else fails, check the browser console for the specific error message.


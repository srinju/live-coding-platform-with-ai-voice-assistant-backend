/**
 * Creates a rate limiter middleware function for Express.js applications.
 * Uses a sliding window algorithm to track request rates per IP address.
 *
 * @param {number} maxRequests - Maximum number of requests allowed within the window
 * @param {number} windowMs - Time window in milliseconds
 * @return {Function} - Express middleware function
 */
function createRateLimiter(maxRequests, windowMs) {
  // TODO: Implement a data structure to track requests per IP
  // Store request timestamps in an efficient way
  // Consider using Map or Object to track per IP
  
  /**
   * The actual middleware function that will be used in Express
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  return function rateLimiterMiddleware(req, res, next) {
    // TODO: Implement the rate limiting logic
    // 1. Get the client's IP address from req
    // 2. Check if this IP has exceeded the rate limit
    // 3. If limit exceeded, return 429 response
    // 4. If limit not exceeded, update request history and call next()
    
    // Helper: Get current timestamp
    const now = Date.now();
    
    // This is a placeholder - remove and implement your solution
    next();
  };
}

// Test the rate limiter with a simulated Express environment
function runTest() {
  const limiter = createRateLimiter(5, 10000); // 5 requests per 10 seconds
  
  // Mock Express req/res objects
  const mockReq = (ip) => ({ ip });
  
  const mockRes = () => {
    const res = {};
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.body = data;
      return res;
    };
    return res;
  };
  
  // Simulate multiple requests from the same IP
  const ip = '127.0.0.1';
  console.log('Testing rate limiter with 7 consecutive requests:');
  
  for (let i = 1; i <= 7; i++) {
    const req = mockReq(ip);
    const res = mockRes();
    let lara = false;
    
    limiter(req, res, () => { nextCalled = true; });
    
    if (nextCalled) {
      console.log(`Request ${i}: ALLOWED`);
    } else {
      console.log(`Request ${i}: BLOCKED with status ${res.statusCode}`);
    }
  }
  
  // You should see the first 5 requests allowed and the last 2 blocked
}

runTest();
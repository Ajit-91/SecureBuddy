import { Request, Response, NextFunction } from "express";
import config from "../config";
import logger from "../shared/logger";

// Helper function to extract a cookie value from headers manually
const getCookie = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const c of cookies) {
    const [key, val] = c.trim().split("=");
    if (key === name) {
      return decodeURIComponent(val || "");
    }
  }
  return null;
};

export const docsAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const docsPassword = config.system.docsPassword;

  // If no password is configured in env, allow open access
  if (!docsPassword) {
    return next();
  }

  const cookiePassword = getCookie(req.headers.cookie, "docs_password");

  if (cookiePassword === docsPassword) {
    return next();
  }

  // If password does not match, respond with custom window.prompt JS logic
  res.setHeader("Content-Type", "text/html");
  return res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SecureBuddy Docs Access</title>
      <style>
        body {
          background-color: #030712;
          color: #f9fafb;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .card {
          background: rgba(17, 24, 39, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 30px;
          text-align: center;
          max-width: 380px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        h1 {
          color: #f43f5e;
          font-size: 1.5rem;
          margin-bottom: 12px;
        }
        p {
          color: #9ca3af;
          margin-bottom: 20px;
          font-size: 0.95rem;
        }
        button {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: transform 0.2s;
        }
        button:hover {
          transform: translateY(-1px);
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Access Protected Docs</h1>
        <p>This documentation folder is password protected. Enter the credentials to proceed.</p>
        <button onclick="promptPassword()">Enter Password</button>
      </div>

      <script>
        function promptPassword() {
          const pass = prompt("Enter password to access SecureBuddy Docs:");
          if (pass) {
            // Set cookie valid for 1 day under path /docs
            document.cookie = "docs_password=" + encodeURIComponent(pass) + "; path=/docs; max-age=86400; SameSite=Lax";
            window.location.reload();
          }
        }
        // Auto-run on mount
        window.onload = function() {
          setTimeout(promptPassword, 100);
        };
      </script>
    </body>
    </html>
  `);
};

FROM mcr.microsoft.com/playwright:v1.45.0-jammy

# Disable waiting for fonts on screenshot to prevent timeouts on slow font CDNs
ENV PW_TEST_SCREENSHOT_NO_FONTS_READY=1

# Set up working directory
WORKDIR /app

# Copy package configurations and install node modules
COPY package.json ./
RUN npm install

# Copy analysis script
COPY analyze.js ./

# Pre-create output directory
RUN mkdir -p /app/output

# Executable entrypoint
ENTRYPOINT ["node", "analyze.js"]

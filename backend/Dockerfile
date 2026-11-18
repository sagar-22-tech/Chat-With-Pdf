FROM denoland/deno:latest

# Render expects your app to listen on the PORT env var (default 10000)
EXPOSE 10000

WORKDIR /app

# Copy your dependency configuration first to cache layers
COPY deno.json* deno.lock* ./
RUN deno install

# Copy the rest of your backend code
COPY . .

# Cache your main entry file (replace main.ts with your entry file name)
RUN deno cache main.ts

# Run with necessary permissions
CMD ["run", "--allow-net", "--allow-env", "main.ts"]

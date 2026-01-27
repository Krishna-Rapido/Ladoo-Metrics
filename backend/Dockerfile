# OpenVPN-enabled Python container for Render.com
# NOTE: Render containers have restricted privileges. OpenVPN requires /dev/net/tun
# and NET_ADMIN capability. If VPN fails, contact Render support for privileged access.

FROM python:3.11-slim

# Install OpenVPN and networking tools
RUN apt-get update && apt-get install -y \
    openvpn \
    iproute2 \
    iptables \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Add entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose the application port
EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]

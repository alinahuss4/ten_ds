# Rewire the State Hackathon

## Introducing PatrolLens

An interactive dashboard built to visualise London crime data and simulate live emergency calls. It uses **Leaflet**, **Plotly**, and the **Web Speech API** to map incidents, analyse transcriptions, and support dispatcher decision-making.

## Repo contents

- index.html: UI layout, loads Leaflet, heatmap, Plotly, Font Awesome, and dashboard.js.
- dashboard.js: All front-end logic: data loading from CSVs, heatmap/markers, filters, simulated calls, and advanced sentiment analysis for transcripts.
- https_server.py: Minimal HTTPS static server (TLS on port 8443) with permissive CORS headers. Required for mic access (secure context).
- server.pem: TLS cert+key (self-signed). Replace if needed.

## Prerequisites

- Python 3.8+ (standard library only; no pip installs needed).
- Chrome or Edge recommended (Web Speech API). Microphone requires HTTPS (or localhost).

# How to Run Locally

1. Clone the repository
    git clone https://github.com/alinahuss4/ten_ds.git

2. Run this command in Bash
    python3 https_server.py or (if that fails) python https_server.py

3. Open the dashboard
    In your browser, visit: https://localhost:8443/index.html

    If your browser warns about the certificate, click Advanced → Proceed to localhost (this is safe for local testing).

4. Test the dashboard
- Toggle map layers (heatmap, incidents, police units)
- Filter by crime type, postcode, or time range
- Click Start Listening and allow mic access to test live call transcription
- Keyboard shortcuts:
    - Ctrl + S → Simulate a random call
    - Ctrl + R → Reset filters
    - Ctrl + C → Clear simulation

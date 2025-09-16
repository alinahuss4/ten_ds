// Dashboard JavaScript for London Crime Heatmap
class CrimeDashboard {
    constructor() {
        this.map = null;
        this.heatmapLayer = null;
        this.incidentMarkers = L.layerGroup();
        this.policeUnits = L.layerGroup();
        this.crimeData = [];
        this.callData = [];
        this.filteredData = [];
        this.activeCall = null;

        this.initializeMap();
        this.loadData();
        this.setupEventListeners();
        this.updateClock();
        this.startDataRefresh();
    }

    initializeMap() {
        // Initialize the map centered on London
        this.map = L.map('map').setView([51.5074, -0.1278], 11);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);

        // Add layer groups to map
        this.incidentMarkers.addTo(this.map);
        this.policeUnits.addTo(this.map);

        // Add some simulated police units
        this.addPoliceUnits();
    }

    async loadData() {
        try {
            // Load crime data
            const crimeResponse = await fetch('df_crime.csv');
            const crimeText = await crimeResponse.text();
            this.crimeData = this.parseCSV(crimeText);

            // Load call data
            const callResponse = await fetch('df_call.csv');
            const callText = await callResponse.text();
            this.callData = this.parseCSV(callText);

            // Initialize with all data
            this.filteredData = this.crimeData.filter(row =>
                row.Latitude && row.Longitude &&
                !isNaN(parseFloat(row.Latitude)) &&
                !isNaN(parseFloat(row.Longitude))
            );

            this.updateVisualization();
            this.updateStatistics();
            this.updateHotspots();
            this.loadRecentCalls();
            this.createTimeline();
        } catch (error) {
            console.error('Error loading data:', error);
            // Use mock data if files aren't available
            this.loadMockData();
        }
    }

    parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        return lines.slice(1).map(line => {
            const values = this.parseCSVLine(line);
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] ? values[index].trim() : '';
            });
            return obj;
        });
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);
        return values;
    }

    loadMockData() {
        // Mock crime data for demonstration
        this.crimeData = [
            { Latitude: 51.5074, Longitude: -0.1278, 'Crime type': 'Theft from the person', Month: '2025-07', Location: 'Westminster', Postcode: 'SW1A 1AA' },
            { Latitude: 51.5155, Longitude: -0.0922, 'Crime type': 'Bicycle theft', Month: '2025-07', Location: 'City of London', Postcode: 'EC2M 1NH' },
            { Latitude: 51.4994, Longitude: -0.1270, 'Crime type': 'Theft from the person', Month: '2025-07', Location: 'South Bank', Postcode: 'SE1 7TP' },
            { Latitude: 51.5287, Longitude: -0.2416, 'Crime type': 'Bicycle theft', Month: '2025-07', Location: 'Paddington', Postcode: 'W2 1NY' }
        ];

        this.callData = [
            { Transcript: 'My bike was stolen from outside the train station', 'Crime Type': 'Bicycle theft', Postcode: 'W2 1NY', Timestamp: new Date().toISOString() }
        ];

        this.filteredData = this.crimeData;
        this.updateVisualization();
        this.updateStatistics();
        this.updateHotspots();
        this.loadRecentCalls();
        this.createTimeline();
    }

    updateVisualization() {
        this.updateHeatmap();
        this.updateIncidentMarkers();
    }

    updateHeatmap() {
        // Remove existing heatmap
        if (this.heatmapLayer) {
            this.map.removeLayer(this.heatmapLayer);
        }

        if (!document.getElementById('show-heatmap').checked) return;

        // Prepare heatmap data
        const heatmapData = this.filteredData.map(crime => [
            parseFloat(crime.Latitude),
            parseFloat(crime.Longitude),
            0.8 // intensity
        ]).filter(point => !isNaN(point[0]) && !isNaN(point[1]));

        // Create heatmap layer
        this.heatmapLayer = L.heatLayer(heatmapData, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: {
                0.0: 'blue',
                0.2: 'cyan',
                0.4: 'lime',
                0.6: 'yellow',
                0.8: 'orange',
                1.0: 'red'
            }
        }).addTo(this.map);

        this.updateHeatmapIntensity();
    }

    updateIncidentMarkers() {
        this.incidentMarkers.clearLayers();

        if (!document.getElementById('show-incidents').checked) return;

        this.filteredData.slice(0, 100).forEach(crime => { // Limit to 100 for performance
            if (crime.Latitude && crime.Longitude) {
                const lat = parseFloat(crime.Latitude);
                const lng = parseFloat(crime.Longitude);

                if (!isNaN(lat) && !isNaN(lng)) {
                    const crimeType = crime['Crime type'] || crime.CrimeType || 'Unknown';
                    const icon = this.getCrimeIcon(crimeType);

                    const marker = L.marker([lat, lng], { icon })
                        .bindPopup(`
                            <strong>${crimeType}</strong><br>
                            Location: ${crime.Location || 'Unknown'}<br>
                            Date: ${crime.Month || 'Unknown'}<br>
                            Postcode: ${crime.Postcode || 'Unknown'}<br>
                            Status: ${crime['Last outcome category'] || 'Unknown'}
                        `);

                    this.incidentMarkers.addLayer(marker);
                }
            }
        });
    }

    getCrimeIcon(crimeType) {
        const color = {
            'Theft from the person': '#e74c3c',
            'Bicycle theft': '#f39c12',
            'Shoplifting': '#9b59b6',
            'Other theft': '#34495e'
        }[crimeType] || '#95a5a6';

        return L.divIcon({
            html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [16, 16],
            className: 'crime-marker'
        });
    }

    addPoliceUnits() {
        const policePositions = [
            { lat: 51.5074, lng: -0.1278, id: 'UNIT-001', status: 'Available' },
            { lat: 51.5155, lng: -0.0922, id: 'UNIT-002', status: 'Busy' },
            { lat: 51.4994, lng: -0.1270, id: 'UNIT-003', status: 'Available' },
            { lat: 51.5287, lng: -0.2416, id: 'UNIT-004', status: 'En Route' },
            { lat: 51.4545, lng: -0.1085, id: 'UNIT-005', status: 'Available' }
        ];

        policePositions.forEach(unit => {
            const color = unit.status === 'Available' ? '#27ae60' :
                         unit.status === 'Busy' ? '#e74c3c' : '#f39c12';

            const icon = L.divIcon({
                html: `<i class="fas fa-car" style="color: ${color}; font-size: 16px;"></i>`,
                iconSize: [20, 20],
                className: 'police-unit-marker'
            });

            const marker = L.marker([unit.lat, unit.lng], { icon })
                .bindPopup(`
                    <strong>${unit.id}</strong><br>
                    Status: ${unit.status}<br>
                    Last Update: ${new Date().toLocaleTimeString()}
                `);

            this.policeUnits.addLayer(marker);
        });
    }

    updateFilters() {
        const crimeType = document.getElementById('crime-type-filter').value;
        const postcode = document.getElementById('postcode-filter').value.toUpperCase();
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        const timeFilter = document.getElementById('time-filter').value;

        this.filteredData = this.crimeData.filter(crime => {
            // Crime type filter
            if (crimeType && crime['Crime type'] !== crimeType) return false;

            // Postcode filter
            if (postcode && (!crime.Postcode || !crime.Postcode.toUpperCase().includes(postcode))) return false;

            // Date filters
            if (dateFrom || dateTo) {
                const crimeDate = new Date(crime.Month + '-01');
                if (dateFrom && crimeDate < new Date(dateFrom)) return false;
                if (dateTo && crimeDate > new Date(dateTo)) return false;
            }

            return true;
        });

        this.updateVisualization();
        this.updateStatistics();
        this.updateHotspots();
    }

    resetFilters() {
        document.getElementById('crime-type-filter').value = '';
        document.getElementById('postcode-filter').value = '';
        document.getElementById('date-from').value = '';
        document.getElementById('date-to').value = '';
        document.getElementById('time-filter').value = '';

        this.filteredData = this.crimeData;
        this.updateVisualization();
        this.updateStatistics();
        this.updateHotspots();
    }

    updateStatistics() {
        document.getElementById('total-incidents').textContent = this.filteredData.length;

        // Calculate recent incidents (mock - in real system would check timestamps)
        const recentCount = Math.floor(this.filteredData.length * 0.1);
        document.getElementById('recent-incidents').textContent = recentCount;
    }

    updateHotspots() {
        // Group crimes by postcode and find top hotspots
        const postcodeCount = {};
        this.filteredData.forEach(crime => {
            const postcode = crime.Postcode || 'Unknown';
            postcodeCount[postcode] = (postcodeCount[postcode] || 0) + 1;
        });

        const sortedHotspots = Object.entries(postcodeCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        const hotspotsDiv = document.getElementById('hotspot-areas');
        hotspotsDiv.innerHTML = sortedHotspots.map(([postcode, count]) =>
            `<div class="stat-row">
                <span>${postcode}:</span>
                <span>${count} incidents</span>
            </div>`
        ).join('');
    }

    loadRecentCalls() {
        const callsList = document.getElementById('recent-calls-list');
        const recentCalls = this.callData.slice(0, 5);

        callsList.innerHTML = recentCalls.map(call =>
            `<div class="call-item">
                <div class="call-time">${new Date(call.Timestamp).toLocaleTimeString()}</div>
                <div>${(call.Transcript || 'No transcript available').substring(0, 80)}...</div>
                <div><strong>${call['Crime Type'] || 'Unknown'}</strong> - ${call.Postcode || 'Unknown'}</div>
            </div>`
        ).join('');
    }

    createTimeline() {
        // Create hourly crime data for the timeline
        const hourlyData = new Array(24).fill(0);

        this.filteredData.forEach(crime => {
            // Mock hour assignment since we don't have hour data in the CSV
            const hour = Math.floor(Math.random() * 24);
            hourlyData[hour]++;
        });

        const hours = Array.from({length: 24}, (_, i) => `${i}:00`);

        const data = [{
            x: hours,
            y: hourlyData,
            type: 'bar',
            marker: {
                color: '#3498db',
                line: {
                    color: '#2980b9',
                    width: 1
                }
            }
        }];

        const layout = {
            title: false,
            xaxis: {
                title: 'Hour of Day',
                color: '#ecf0f1',
                gridcolor: '#555'
            },
            yaxis: {
                title: 'Incidents',
                color: '#ecf0f1',
                gridcolor: '#555'
            },
            plot_bgcolor: '#2c3e50',
            paper_bgcolor: '#34495e',
            font: {
                color: '#ecf0f1'
            },
            margin: { t: 20, r: 20, b: 40, l: 40 }
        };

        const config = {
            responsive: true,
            displayModeBar: false
        };

        Plotly.newPlot('timeline-chart', data, layout, config);
    }

    simulateCall() {
        const mockCalls = [
            {
                transcript: "Hello, my bicycle has been stolen from outside Liverpool Street Station. It happened about 20 minutes ago. It's a red mountain bike, Trek brand. I'm at postcode EC2M 7PN.",
                crimeType: "Bicycle theft",
                postcode: "EC2M 7PN",
                suspect: "Male, approximately 25-30 years old, wearing dark clothing"
            },
            {
                transcript: "Someone has just snatched my phone on Oxford Street near Bond Street tube station. Asian male, about 5'8\", ran towards Marble Arch. Postcode is W1C 1JN.",
                crimeType: "Theft from the person",
                postcode: "W1C 1JN",
                suspect: "Asian male, 5'8\", running towards Marble Arch"
            },
            {
                transcript: "My purse was stolen from my bag while I was shopping in Covent Garden. I didn't see who did it. I'm near the market, postcode WC2E 8RF.",
                crimeType: "Theft from the person",
                postcode: "WC2E 8RF",
                suspect: "Unknown - theft from bag while shopping"
            }
        ];

        const call = mockCalls[Math.floor(Math.random() * mockCalls.length)];
        this.activeCall = call;

        // Display the transcript with typing effect
        this.typeTranscript(call.transcript);

        // Auto-filter based on call content
        this.autoFilterFromCall(call);

        // Show priority alert
        this.showPriorityAlert(call);

        // Add to recent calls
        this.addToRecentCalls(call);
    }

    typeTranscript(text) {
        const transcriptBox = document.getElementById('live-transcript');
        transcriptBox.innerHTML = '';

        let i = 0;
        const typeWriter = () => {
            if (i < text.length) {
                transcriptBox.innerHTML += text.charAt(i);
                transcriptBox.scrollTop = transcriptBox.scrollHeight;
                i++;
                setTimeout(typeWriter, 50);
            }
        };
        typeWriter();
    }

    autoFilterFromCall(call) {
        // Extract postcode area from full postcode
        const postcodeArea = call.postcode.split(' ')[0];

        // Set filters based on call content
        document.getElementById('crime-type-filter').value = call.crimeType;
        document.getElementById('postcode-filter').value = postcodeArea;

        // Trigger filter update
        this.updateFilters();

        // Focus on the area if we have coordinates
        this.focusOnPostcode(call.postcode);
    }

    focusOnPostcode(postcode) {
        // Find crimes near this postcode and focus map
        const nearbycrimes = this.crimeData.filter(crime =>
            crime.Postcode && crime.Postcode.includes(postcode.split(' ')[0])
        );

        if (nearbycrimes.length > 0) {
            const lat = parseFloat(nearbycrimes[0].Latitude);
            const lng = parseFloat(nearbycrimes[0].Longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
                this.map.setView([lat, lng], 15);
            }
        }
    }

    showPriorityAlert(call) {
        const alertDiv = document.getElementById('priority-alert');
        const messageSpan = document.getElementById('alert-message');

        messageSpan.textContent = `New ${call.crimeType} reported at ${call.postcode}`;
        alertDiv.style.display = 'block';

        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 10000);
    }

    addToRecentCalls(call) {
        const callsList = document.getElementById('recent-calls-list');
        const newCall = document.createElement('div');
        newCall.className = 'call-item';
        newCall.innerHTML = `
            <div class="call-time">${new Date().toLocaleTimeString()}</div>
            <div>${call.transcript.substring(0, 80)}...</div>
            <div><strong>${call.crimeType}</strong> - ${call.postcode}</div>
        `;

        callsList.insertBefore(newCall, callsList.firstChild);

        // Keep only last 5 calls
        while (callsList.children.length > 5) {
            callsList.removeChild(callsList.lastChild);
        }
    }

    clearCall() {
        document.getElementById('live-transcript').innerHTML =
            '<div style="color: #95a5a6; font-style: italic;">Waiting for incoming call...</div>';
        this.activeCall = null;
        document.getElementById('priority-alert').style.display = 'none';
    }

    toggleHeatmap() {
        this.updateHeatmap();
    }

    toggleIncidents() {
        this.updateIncidentMarkers();
    }

    togglePoliceUnits() {
        const show = document.getElementById('show-police-units').checked;
        if (show) {
            this.map.addLayer(this.policeUnits);
        } else {
            this.map.removeLayer(this.policeUnits);
        }
    }

    updateHeatmapIntensity() {
        if (this.heatmapLayer) {
            const intensity = parseFloat(document.getElementById('heatmap-intensity').value);
            this.heatmapLayer.setOptions({
                max: intensity
            });
        }
    }

    updateClock() {
        const now = new Date();
        document.getElementById('current-time').textContent =
            now.toLocaleTimeString('en-GB', { hour12: false });
    }

    startDataRefresh() {
        // Update clock every second
        setInterval(() => this.updateClock(), 1000);

        // Refresh data every 30 seconds (in real system, this would fetch new data)
        setInterval(() => {
            this.updateStatistics();
            // Could also refresh crime data here
        }, 30000);
    }

    setupEventListeners() {
        // Map events
        this.map.on('click', (e) => {
            console.log(`Clicked at ${e.latlng.lat}, ${e.latlng.lng}`);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'r':
                        e.preventDefault();
                        this.resetFilters();
                        break;
                    case 's':
                        e.preventDefault();
                        this.simulateCall();
                        break;
                    case 'c':
                        e.preventDefault();
                        this.clearCall();
                        break;
                }
            }
        });
    }
}

// Global functions for HTML onclick handlers
let dashboard;

function updateFilters() {
    dashboard.updateFilters();
}

function resetFilters() {
    dashboard.resetFilters();
}

function simulateCall() {
    dashboard.simulateCall();
}

function clearCall() {
    dashboard.clearCall();
}

function toggleHeatmap() {
    dashboard.toggleHeatmap();
}

function toggleIncidents() {
    dashboard.toggleIncidents();
}

function togglePoliceUnits() {
    dashboard.togglePoliceUnits();
}

function updateHeatmapIntensity() {
    dashboard.updateHeatmapIntensity();
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new CrimeDashboard();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CrimeDashboard;
}
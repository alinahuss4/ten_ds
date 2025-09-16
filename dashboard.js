// Dashboard JavaScript for London Crime Heatmap
class CrimeDashboard {
    constructor() {
        this.map = null;
        this.heatmapLayer = null;
        this.incidentMarkers = L.layerGroup();
        this.policeUnits = L.layerGroup();
        this.crimeData = [];
        this.callData = [];
        this.suspectData = [];
        this.officerData = [];
        this.confidenceData = [];
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

            // Load suspect data
            const suspectResponse = await fetch('df_suspect.csv');
            const suspectText = await suspectResponse.text();
            this.suspectData = this.parseCSV(suspectText);

            // Load confidence data
            const confidenceResponse = await fetch('df_confidence.csv');
            const confidenceText = await confidenceResponse.text();
            this.confidenceData = this.parseCSV(confidenceText);

            // Load officer data
            const officerResponse = await fetch('notional_response_team_officers.csv');
            const officerText = await officerResponse.text();
            this.officerData = this.parseCSV(officerText);

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
            this.addPoliceUnits();
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading CSV data. Please ensure all CSV files are present in the directory.');
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
        // Use officer data from CSV to create police units
        if (!this.officerData || this.officerData.length === 0) return;

        // Group officers by postcode and use the first few locations
        const officersByLocation = {};
        this.officerData.forEach(officer => {
            const postcode = officer.postcode;
            if (postcode) {
                if (!officersByLocation[postcode]) {
                    officersByLocation[postcode] = [];
                }
                officersByLocation[postcode].push(officer);
            }
        });

        // Create police units from officer locations (limit to first 10 for performance)
        Object.entries(officersByLocation).slice(0, 10).forEach(([postcode, officers], index) => {
            const totalOfficers = officers.reduce((sum, officer) =>
                sum + parseInt(officer.Response_Team_Officers || 0), 0);

            // Find matching crime data to get coordinates for this postcode
            const crimeAtLocation = this.crimeData.find(crime =>
                crime.Postcode && crime.Postcode.includes(postcode.split(' ')[0])
            );

            if (crimeAtLocation && crimeAtLocation.Latitude && crimeAtLocation.Longitude) {
                const lat = parseFloat(crimeAtLocation.Latitude);
                const lng = parseFloat(crimeAtLocation.Longitude);

                if (!isNaN(lat) && !isNaN(lng)) {
                    const unitId = `UNIT-${String(index + 1).padStart(3, '0')}`;
                    const status = totalOfficers >= 5 ? 'Available' :
                                 totalOfficers >= 3 ? 'En Route' : 'Busy';
                    const color = status === 'Available' ? '#27ae60' :
                                 status === 'Busy' ? '#e74c3c' : '#f39c12';

                    const icon = L.divIcon({
                        html: `<i class="fas fa-car" style="color: ${color}; font-size: 16px;"></i>`,
                        iconSize: [20, 20],
                        className: 'police-unit-marker'
                    });

                    const marker = L.marker([lat, lng], { icon })
                        .bindPopup(`
                            <strong>${unitId}</strong><br>
                            Location: ${postcode}<br>
                            Officers: ${totalOfficers}<br>
                            Status: ${status}<br>
                            Last Update: ${new Date().toLocaleTimeString()}
                        `);

                    this.policeUnits.addLayer(marker);
                }
            }
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
        if (!this.callData || this.callData.length === 0) {
            console.error('No call data available');
            return;
        }

        // Get a random call from the CSV data
        const randomCall = this.callData[Math.floor(Math.random() * this.callData.length)];

        // Format the call data to match expected structure
        const call = {
            transcript: randomCall.Transcript || "No transcript available",
            crimeType: randomCall['Crime Type'] || "Unknown",
            postcode: randomCall.Postcode || "Unknown",
            suspect: "Investigation ongoing"
        };

        // Try to find matching suspect data for this crime type and postcode
        if (this.suspectData && this.suspectData.length > 0) {
            const matchingSuspect = this.suspectData.find(suspect =>
                suspect['Crime Type'] === call.crimeType ||
                suspect.Postcode === call.postcode
            );
            if (matchingSuspect) {
                call.suspect = `${matchingSuspect.Description || 'No description'} - ${matchingSuspect.Arrested === 'Yes' ? 'Arrested' : 'At large'}`;
            }
        }

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
// Dashboard JavaScript for London Crime Heatmap
class CrimeDashboard {
    constructor() {
        this.map = null;
        this.heatmapLayer = null;
        this.incidentMarkers = L.layerGroup();
        this.policeUnits = L.layerGroup();
        this.highlightMarker = null;
        this.crimeData = [];
        this.callData = [];
        this.suspectData = [];
        this.officerData = [];
        this.confidenceData = [];
        this.filteredData = [];
        this.activeCall = null;

        // Voice recognition properties
        this.recognition = null;
        this.isListening = false;
        this.shouldBeListening = false;
        this.currentTranscript = '';
        this.extractedInfo = {
            name: null,
            location: null,
            postcode: null,
            crimeType: null,
            description: null
        };

        this.initializeMap();
        this.loadData();
        this.initializeVoiceRecognition();
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
            const crimeResponse = await fetch('df_crime_ext.csv');
            const crimeText = await crimeResponse.text();
            this.crimeData = this.parseCSV(crimeText);

            // Load call data
            const callResponse = await fetch('df_call_ext.csv');
            const callText = await callResponse.text();
            this.callData = this.parseCSV(callText);

            // Load suspect data
            const suspectResponse = await fetch('df_suspect_ext.csv');
            const suspectText = await suspectResponse.text();
            this.suspectData = this.parseCSV(suspectText);

            // Load confidence data
            const confidenceResponse = await fetch('df_confidence_ext.csv');
            const confidenceText = await confidenceResponse.text();
            this.confidenceData = this.parseCSV(confidenceText);

            // Load police data
            const policeResponse = await fetch('df_police_ext.csv');
            const policeText = await policeResponse.text();
            this.officerData = this.parseCSV(policeText);

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

    initializeVoiceRecognition() {
        // Check if browser supports speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error('Speech recognition not supported in this browser. Please use Chrome or Edge.');
            document.getElementById('start-listening-btn').disabled = true;
            document.getElementById('live-transcript').innerHTML = '<div style="color: #e74c3c; font-style: italic;">⚠️ Speech recognition not supported. Please use Chrome or Edge.</div>';
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-GB';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateListeningUI();
            console.log('🎤 Voice recognition started - speak now!');
            this.showListeningFeedback();
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            console.log('📝 Speech recognition result received, processing...');

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                console.log(`Result ${i}: ${transcript} (final: ${event.results[i].isFinal})`);

                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            // Process both final and interim results for real-time updates
            const fullText = this.currentTranscript + finalTranscript + interimTranscript;

            // Extract info from interim results too for immediate updates
            this.extractInformationFromText(fullText);
            this.updateExtractedInfoDisplay();
            this.updateMapFromExtractedInfo();

            if (finalTranscript) {
                this.currentTranscript += finalTranscript;
                console.log('📄 Final transcript:', this.currentTranscript);
            }

            // Update live transcript display
            this.updateTranscriptDisplay(this.currentTranscript, interimTranscript);
        };

        this.recognition.onerror = (event) => {
            console.error('🔴 Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                alert('Microphone access was denied. Please:\n1. Click the microphone icon in your browser\'s address bar\n2. Select "Allow" for microphone access\n3. Refresh the page and try again');
                this.shouldBeListening = false;
            } else if (event.error === 'no-speech') {
                console.log('No speech detected, continuing to listen...');
                // Don't stop listening on no-speech, just continue
                return;
            } else {
                alert(`Speech recognition error: ${event.error}. Make sure you are using Chrome/Edge with HTTPS or localhost.`);
            }
            this.stopListening();
        };

        this.recognition.onend = () => {
            console.log('🔴 Voice recognition ended');
            this.isListening = false;
            this.updateListeningUI();
            // Auto-restart if we were supposed to be listening (unless manually stopped)
            if (this.shouldBeListening) {
                console.log('🔄 Auto-restarting speech recognition...');
                setTimeout(() => {
                    if (this.shouldBeListening) {
                        this.recognition.start();
                    }
                }, 100);
            }
        };
    }

    async startListening() {
        if (!this.recognition) {
            alert('Speech recognition not available in this browser. Please use Chrome or Edge.');
            return;
        }

        console.log('🚀 Starting voice recognition...');
        this.shouldBeListening = true;
        this.currentTranscript = '';
        this.extractedInfo = {
            name: null,
            location: null,
            postcode: null,
            crimeType: null,
            description: null
        };

        this.clearExtractedInfoDisplay();

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
            alert('Error starting voice recognition: ' + error.message + '. Make sure you are using HTTPS or localhost.');
        }
    }

    stopListening() {
        console.log('🛑 Stopping voice recognition...');
        this.shouldBeListening = false;
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    showPermissionMessage(message) {
        const transcriptBox = document.getElementById('live-transcript');
        transcriptBox.innerHTML = `<div style="color: #e74c3c; font-style: italic;">⚠️ ${message}</div>`;
    }

    showListeningFeedback() {
        const transcriptBox = document.getElementById('live-transcript');
        transcriptBox.innerHTML = '<div style="color: #27ae60; font-style: italic;">🎤 Listening... Start speaking!</div>';
    }

    processVoiceInput(text) {
        this.currentTranscript += text + ' ';

        // Extract information from the speech
        this.extractInformationFromText(text);

        // Update displays
        this.updateExtractedInfoDisplay();
        this.updateMapFromExtractedInfo();
    }

    extractInformationFromText(text) {
        const lowerText = text.toLowerCase();
        console.log('🔍 Analyzing text:', text);

        // Extract postcode (UK format: letters-numbers-letters)
        const postcodeMatch = text.match(/\b[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}\b/gi);
        if (postcodeMatch && !this.extractedInfo.postcode) {
            this.extractedInfo.postcode = postcodeMatch[0].toUpperCase();
            console.log('✅ Found postcode:', this.extractedInfo.postcode);
        }

        // Extract crime type - more comprehensive detection
        const crimeTypes = [
            { keywords: ['bike', 'bicycle'], type: 'Bicycle theft' },
            { keywords: ['purse', 'wallet', 'phone', 'bag'], type: 'Theft from the person' },
            { keywords: ['mugging', 'mugged'], type: 'Theft from the person' },
            { keywords: ['shoplifting', 'shop'], type: 'Shoplifting' },
            { keywords: ['burglary', 'broke in'], type: 'Burglary' },
            { keywords: ['assault', 'attacked'], type: 'Violence and sexual offences' },
            { keywords: ['theft', 'stolen'], type: 'Theft from the person' }
        ];

        if (!this.extractedInfo.crimeType) {
            for (const crime of crimeTypes) {
                if (crime.keywords.some(keyword => lowerText.includes(keyword))) {
                    this.extractedInfo.crimeType = crime.type;
                    console.log('✅ Found crime type:', this.extractedInfo.crimeType);
                    break;
                }
            }
        }

        // Extract name (after "my name is" or "I'm")
        const namePatterns = [
            /my name is ([a-zA-Z\s]+)/i,
            /i'm ([a-zA-Z\s]+)/i,
            /this is ([a-zA-Z\s]+)/i
        ];

        if (!this.extractedInfo.name) {
            for (const pattern of namePatterns) {
                const nameMatch = text.match(pattern);
                if (nameMatch) {
                    this.extractedInfo.name = nameMatch[1].trim();
                    console.log('✅ Found name:', this.extractedInfo.name);
                    break;
                }
            }
        }

        // Extract location mentions - improved patterns
        const locationPatterns = [
            /(?:at|on|near|outside|in front of|by|in)\s+([A-Za-z0-9\s,]+?)(?:\s|$|\.|\,)/gi,
            /([A-Za-z\s]+(?:street|road|avenue|lane|station|park|shop|store|centre|center|square|market|tube|underground))/gi
        ];

        if (!this.extractedInfo.location) {
            for (const pattern of locationPatterns) {
                const matches = [...text.matchAll(pattern)];
                for (const match of matches) {
                    if (match[1] && match[1].length > 3 && match[1].length < 50) {
                        this.extractedInfo.location = match[1].trim();
                        console.log('✅ Found location:', this.extractedInfo.location);
                        break;
                    }
                }
                if (this.extractedInfo.location) break;
            }
        }
    }

    updateTranscriptDisplay(finalText, interimText) {
        const transcriptBox = document.getElementById('live-transcript');
        transcriptBox.innerHTML = finalText + '<span style="color: #95a5a6;">' + interimText + '</span>';
        transcriptBox.scrollTop = transcriptBox.scrollHeight;
    }

    updateExtractedInfoDisplay() {
        // Update the extracted information panel
        document.getElementById('extracted-name').textContent = this.extractedInfo.name || 'Not provided';
        document.getElementById('extracted-location').textContent = this.extractedInfo.location || 'Not provided';
        document.getElementById('extracted-postcode').textContent = this.extractedInfo.postcode || 'Not provided';
        document.getElementById('extracted-crime-type').textContent = this.extractedInfo.crimeType || 'Not provided';
    }

    clearExtractedInfoDisplay() {
        document.getElementById('extracted-name').textContent = 'Listening...';
        document.getElementById('extracted-location').textContent = 'Listening...';
        document.getElementById('extracted-postcode').textContent = 'Listening...';
        document.getElementById('extracted-crime-type').textContent = 'Listening...';

        const transcriptBox = document.getElementById('live-transcript');
        transcriptBox.innerHTML = '<div style="color: #27ae60; font-style: italic;">🎤 Listening for emergency call...</div>';
    }

    updateMapFromExtractedInfo() {
        if (this.extractedInfo.postcode) {
            // Filter crimes by exact postcode first, then postcode area
            const exactPostcode = this.extractedInfo.postcode.trim().toUpperCase();
            const postcodeArea = exactPostcode.split(' ')[0];

            console.log('🎯 Filtering by postcode:', exactPostcode);
            document.getElementById('postcode-filter').value = exactPostcode;

            if (this.extractedInfo.crimeType) {
                document.getElementById('crime-type-filter').value = this.extractedInfo.crimeType;
                console.log('🎯 Filtering by crime type:', this.extractedInfo.crimeType);
            }

            this.updateFilters();
            this.focusOnPostcode(exactPostcode);

            // Show priority alert
            this.showLiveAlert();
        }
    }

    showLiveAlert() {
        const alertDiv = document.getElementById('priority-alert');
        const messageSpan = document.getElementById('alert-message');

        let message = 'Live Emergency Call';
        if (this.extractedInfo.crimeType && this.extractedInfo.postcode) {
            message = `Live Call: ${this.extractedInfo.crimeType} at ${this.extractedInfo.postcode}`;
        }

        messageSpan.textContent = message;
        alertDiv.style.display = 'block';
    }

    updateListeningUI() {
        const startBtn = document.getElementById('start-listening-btn');
        const stopBtn = document.getElementById('stop-listening-btn');

        if (this.isListening) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
        } else {
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
        }
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
        console.log('🔍 Looking for postcode:', postcode);

        // First try to find exact postcode match
        let matchingCrimes = this.crimeData.filter(crime =>
            crime.Postcode && crime.Postcode.trim().toUpperCase() === postcode.toUpperCase()
        );

        console.log('📍 Exact postcode matches found:', matchingCrimes.length);

        let searchMethod = 'exact';

        // If no exact match, try postcode area (first part)
        if (matchingCrimes.length === 0) {
            const postcodeArea = postcode.split(' ')[0];
            matchingCrimes = this.crimeData.filter(crime =>
                crime.Postcode && crime.Postcode.toUpperCase().startsWith(postcodeArea.toUpperCase())
            );
            console.log('📍 Postcode area matches found:', matchingCrimes.length, 'for area:', postcodeArea);
            searchMethod = 'area';
        }

        if (matchingCrimes.length > 0) {
            // Calculate the center point of all matching crimes for better accuracy
            const validCrimes = matchingCrimes.filter(crime =>
                crime.Latitude && crime.Longitude &&
                !isNaN(parseFloat(crime.Latitude)) && !isNaN(parseFloat(crime.Longitude))
            );

            if (validCrimes.length > 0) {
                // If we found exact matches or multiple area matches, use center point
                let lat, lng;

                if (searchMethod === 'exact' || validCrimes.length > 5) {
                    // Calculate center of all matches
                    const avgLat = validCrimes.reduce((sum, crime) => sum + parseFloat(crime.Latitude), 0) / validCrimes.length;
                    const avgLng = validCrimes.reduce((sum, crime) => sum + parseFloat(crime.Longitude), 0) / validCrimes.length;
                    lat = avgLat;
                    lng = avgLng;
                    console.log('🎯 Using center point of', validCrimes.length, 'matches');
                } else {
                    // Use first match for area searches with few results
                    lat = parseFloat(validCrimes[0].Latitude);
                    lng = parseFloat(validCrimes[0].Longitude);
                    console.log('🎯 Using first match from area search');
                }

                console.log('🎯 Focusing map on coordinates:', lat, lng, 'for postcode:', postcode);
                this.map.setView([lat, lng], 15);

                // Add a temporary marker to highlight the location
                this.highlightLocationTemporarily(lat, lng, postcode);
            }
        } else {
            console.log('❌ No location found for postcode:', postcode, '- using approximate location');
            // If no data match found, use approximate UK postcode coordinates
            const approxCoords = this.getApproximatePostcodeLocation(postcode);
            if (approxCoords) {
                console.log('📍 Using approximate coordinates for', postcode, ':', approxCoords);
                this.map.setView([approxCoords.lat, approxCoords.lng], 15);
                this.highlightLocationTemporarily(approxCoords.lat, approxCoords.lng, postcode + ' (Approx)');
            }
        }
    }

    getApproximatePostcodeLocation(postcode) {
        // Approximate coordinates for common London postcode areas
        const postcodeAreas = {
            'N1': { lat: 51.5311, lng: -0.1022 }, // Islington
            'E1': { lat: 51.5154, lng: -0.0714 }, // Whitechapel
            'W1': { lat: 51.5174, lng: -0.1372 }, // West End
            'SW1': { lat: 51.4975, lng: -0.1357 }, // Westminster
            'SE1': { lat: 51.5041, lng: -0.0967 }, // Southwark
            'NW1': { lat: 51.5355, lng: -0.1426 }, // Camden
            'EC1': { lat: 51.5211, lng: -0.1051 }, // Clerkenwell
            'EC2': { lat: 51.5155, lng: -0.0922 }, // City of London
            'WC1': { lat: 51.5252, lng: -0.1308 }, // Bloomsbury
            'WC2': { lat: 51.5120, lng: -0.1269 }, // Covent Garden
        };

        const area = postcode.split(' ')[0].toUpperCase();
        return postcodeAreas[area] || null;
    }

    highlightLocationTemporarily(lat, lng, postcode) {
        // Remove any existing highlight marker
        if (this.highlightMarker) {
            this.map.removeLayer(this.highlightMarker);
        }

        // Add a highlighted marker for the spoken postcode
        this.highlightMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: `<div style="background-color: #e74c3c; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">📞 ${postcode}</div>`,
                iconSize: [100, 30],
                className: 'highlight-marker'
            })
        }).addTo(this.map);

        // Remove the highlight after 10 seconds
        setTimeout(() => {
            if (this.highlightMarker) {
                this.map.removeLayer(this.highlightMarker);
                this.highlightMarker = null;
            }
        }, 10000);
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

function startListening() {
    dashboard.startListening();
}

function stopListening() {
    dashboard.stopListening();
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new CrimeDashboard();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CrimeDashboard;
}
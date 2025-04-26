document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const generateBtn = document.getElementById('generateBtn');
    const promptInput = document.getElementById('promptInput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultsSection = document.getElementById('resultsSection');
    const filesContainer = document.getElementById('filesContainer');
    const clarificationSection = document.getElementById('clarificationSection');
    const clarificationMessage = document.getElementById('clarificationMessage');
    const clarificationInput = document.getElementById('clarificationInput');
    const submitClarificationBtn = document.getElementById('submitClarificationBtn');
    const configUpload = document.getElementById('configUpload');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const redTeamBtn = document.getElementById('redTeamBtn');
    const blueTeamBtn = document.getElementById('blueTeamBtn');
    const redTeamSuggestions = document.getElementById('redTeamSuggestions');
    const blueTeamSuggestions = document.getElementById('blueTeamSuggestions');
    const redTeamSuggestionsList = document.getElementById('redTeamSuggestionsList');
    const blueTeamSuggestionsList = document.getElementById('blueTeamSuggestionsList');
    const redTeamYesBtn = document.getElementById('redTeamYesBtn');
    const redTeamNoBtn = document.getElementById('redTeamNoBtn');
    const blueTeamYesBtn = document.getElementById('blueTeamYesBtn');
    const blueTeamNoBtn = document.getElementById('blueTeamNoBtn');
    const redTeamSelectionArea = document.getElementById('redTeamSelectionArea');
    const blueTeamSelectionArea = document.getElementById('blueTeamSelectionArea');
    const redTeamCheckboxes = document.getElementById('redTeamCheckboxes');
    const blueTeamCheckboxes = document.getElementById('blueTeamCheckboxes');
    const implementRedTeamBtn = document.getElementById('implementRedTeamBtn');
    const implementBlueTeamBtn = document.getElementById('implementBlueTeamBtn');
    
    // Global storage for generated files
    let generatedFiles = [];

    // Store suggestions for later use
    let redTeamSuggestionItems = [];
    let blueTeamSuggestionItems = [];

    // Store original prompt and any clarification info for final submission
    let promptHistory = {
        originalPrompt: '',
        clarification: ''
    };

    // Handle file upload change event
    configUpload.addEventListener('change', function() {
        if (this.files.length > 0) {
            // Show remove button when a file is selected
            removeFileBtn.style.display = 'block';
            // Show the filename in a tooltip or data attribute
            removeFileBtn.setAttribute('title', `Remove "${this.files[0].name}"`);
        } else {
            // Hide remove button when no file is selected
            removeFileBtn.style.display = 'none';
        }
    });

    // Handle remove file button click
    removeFileBtn.addEventListener('click', function() {
        // Clear the file input
        configUpload.value = '';
        // Hide the remove button
        this.style.display = 'none';
        // Optional: Add a confirmation message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'alert alert-info mt-2';
        messageDiv.textContent = 'File removed';
        messageDiv.style.padding = '0.5rem';
        messageDiv.style.marginBottom = '0.5rem';
        configUpload.parentNode.appendChild(messageDiv);
        // Remove the message after 2 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 2000);
    });

    // Helper function to create downloadable files
    function downloadFile(filename, content) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }
    
    // Helper function to read file content as text
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = error => reject(error);
            reader.readAsText(file);
        });
    }
    
    // Helper function to download all files as ZIP
    function downloadAllFiles() {
        if (generatedFiles.length === 0) {
            alert('No files to download.');
            return;
        }
        
        console.log('Requesting ZIP download...');
        console.log(`Files to include: ${generatedFiles.length}`);
        
        fetch('/api/create-zip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ files: generatedFiles }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            console.log('ZIP response received, getting blob...');
            return response.blob();
        })
        .then(blob => {
            console.log(`Received blob, size: ${blob.size} bytes`);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ludus-configuration.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('Download triggered');
        })
        .catch(error => {
            console.error('Error downloading ZIP:', error);
            alert('Failed to create ZIP file: ' + error.message);
        });
    }
    
    // Create file download cards in the UI
    function displayFiles(files) {
        // Store files globally for the ZIP download feature
        generatedFiles = [...files];
        
        filesContainer.innerHTML = '';
        
        // Group files by directory
        const fileGroups = groupFilesByDirectory(files);
        
        // Display main configuration files first
        if (fileGroups['']) {
            fileGroups[''].forEach(file => {
                addFileCard(file);
            });
        }
        
        // Display custom role files grouped by role
        Object.keys(fileGroups).filter(dir => dir !== '').forEach(directory => {
            // Add directory header
            const dirHeader = document.createElement('div');
            dirHeader.className = 'mt-4 mb-3';
            
            const headerRow = document.createElement('div');
            headerRow.className = 'd-flex justify-content-between align-items-center';
            
            const heading = document.createElement('h4');
            heading.textContent = `Custom Role: ${directory}`;
            headerRow.appendChild(heading);
            
            const downloadAllBtn = document.createElement('button');
            downloadAllBtn.className = 'btn btn-sm btn-outline-primary';
            downloadAllBtn.innerHTML = '<i class="bi bi-download"></i> Download Role';
            downloadAllBtn.addEventListener('click', () => downloadRoleAsZip(directory, fileGroups[directory]));
            headerRow.appendChild(downloadAllBtn);
            
            dirHeader.appendChild(headerRow);
            
            const description = document.createElement('p');
            description.className = 'text-muted';
            description.textContent = `A custom Ansible role for your Ludus deployment`;
            dirHeader.appendChild(description);
            
            filesContainer.appendChild(dirHeader);
            
            // Add files for this role
            fileGroups[directory].forEach(file => {
                addFileCard(file, true);
            });
        });
    }
    
    function addFileCard(file, isRoleFile = false) {
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        
        if (isRoleFile) {
            fileCard.style.marginLeft = '1rem';
        }
        
        const header = document.createElement('div');
        header.className = 'd-flex justify-content-between align-items-center mb-2';
        
        const title = document.createElement('h5');
        title.textContent = isRoleFile ? file.name.split('/').slice(1).join('/') : file.name;
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-sm btn-success';
        downloadBtn.textContent = 'Download';
        downloadBtn.addEventListener('click', () => downloadFile(file.name, file.content));
        
        header.appendChild(title);
        header.appendChild(downloadBtn);
        
        const content = document.createElement('pre');
        content.textContent = file.content;
        
        fileCard.appendChild(header);
        fileCard.appendChild(content);
        filesContainer.appendChild(fileCard);
    }
    
    // Group files by directory (for roles)
    function groupFilesByDirectory(files) {
        const groups = {};
        
        files.forEach(file => {
            const parts = file.name.split('/');
            
            if (parts.length > 1) {
                // This is a role file
                const directory = parts[0];
                
                if (!groups[directory]) {
                    groups[directory] = [];
                }
                
                groups[directory].push(file);
            } else {
                // This is a main file
                if (!groups['']) {
                    groups[''] = [];
                }
                
                groups[''].push(file);
            }
        });
        
        return groups;
    }
    
    // Helper function to download role files as "zip" (simulated)
    function downloadRoleAsZip(roleName, files) {
        // In a real implementation, this would create a zip file
        // For now, we'll download each file individually
        files.forEach(file => {
            downloadFile(file.name, file.content);
        });
        
        alert(`Downloading all files for role: ${roleName}\n\nIn a production version, this would create a zip file.`);
    }
    
    // Function to display analysis results
    function displayAnalysisResults(result) {
        filesContainer.innerHTML = '';
        
        // Add analysis section
        const analysisCard = document.createElement('div');
        analysisCard.className = 'card mb-4';
        
        const analysisCardBody = document.createElement('div');
        analysisCardBody.className = 'card-body';
        
        const analysisTitle = document.createElement('h4');
        analysisTitle.className = 'card-title';
        analysisTitle.textContent = 'Configuration Analysis';
        
        const analysisContent = document.createElement('div');
        analysisContent.innerHTML = `<p>${result.analysis}</p>`;
        
        analysisCardBody.appendChild(analysisTitle);
        analysisCardBody.appendChild(analysisContent);
        analysisCard.appendChild(analysisCardBody);
        filesContainer.appendChild(analysisCard);
        
        // Add suggestions section
        if (result.suggestions && result.suggestions.length > 0) {
            const suggestionsCard = document.createElement('div');
            suggestionsCard.className = 'card mb-4';
            
            const suggestionsCardBody = document.createElement('div');
            suggestionsCardBody.className = 'card-body';
            
            const suggestionsTitle = document.createElement('h4');
            suggestionsTitle.className = 'card-title';
            suggestionsTitle.textContent = 'Improvement Suggestions';
            
            const suggestionsList = document.createElement('ul');
            suggestionsList.className = 'list-group list-group-flush';
            
            result.suggestions.forEach(suggestion => {
                const item = document.createElement('li');
                item.className = 'list-group-item';
                item.textContent = suggestion;
                suggestionsList.appendChild(item);
            });
            
            suggestionsCardBody.appendChild(suggestionsTitle);
            suggestionsCardBody.appendChild(suggestionsList);
            suggestionsCard.appendChild(suggestionsCardBody);
            filesContainer.appendChild(suggestionsCard);
        }
        
        // Add modified files
        if (result.files && result.files.length > 0) {
            // Store files globally for the ZIP download feature
            generatedFiles = [...result.files];
            
            const filesTitle = document.createElement('h4');
            filesTitle.className = 'mb-3';
            filesTitle.textContent = 'Modified Configuration Files';
            filesContainer.appendChild(filesTitle);
            
            result.files.forEach(file => {
                const fileCard = document.createElement('div');
                fileCard.className = 'file-card';
                
                const header = document.createElement('div');
                header.className = 'd-flex justify-content-between align-items-center mb-2';
                
                const title = document.createElement('h5');
                title.textContent = file.name;
                
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'btn btn-sm btn-success';
                downloadBtn.textContent = 'Download';
                downloadBtn.addEventListener('click', () => downloadFile(file.name, file.content));
                
                header.appendChild(title);
                header.appendChild(downloadBtn);
                
                const description = document.createElement('p');
                description.className = 'text-muted';
                description.textContent = file.description || '';
                
                const content = document.createElement('pre');
                content.textContent = file.content;
                
                fileCard.appendChild(header);
                fileCard.appendChild(description);
                fileCard.appendChild(content);
                filesContainer.appendChild(fileCard);
            });
        }
        
        // Show results section
        resultsSection.style.display = 'block';
    }

    // Handle generate button click with integrated file upload
    generateBtn.addEventListener('click', async function() {
        console.log('Generate button clicked');
        const prompt = promptInput.value.trim();
        
        if (!prompt) {
            alert('Please enter your requirements first.');
            return;
        }
        
        // Store original prompt
        promptHistory.originalPrompt = prompt;
        
        // Check if a file is uploaded
        const fileInput = document.getElementById('configUpload');
        const file = fileInput.files[0];
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        generateBtn.disabled = true;
        
        try {
            let fileContent = '';
            let fileName = '';
            let result;
            
            // If a file is uploaded, process it
            if (file) {
                console.log(`File selected: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
                
                // Read the file content
                fileContent = await readFileAsText(file);
                fileName = file.name;
                
                // For ZIP files, we need to handle differently
                if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
                    console.log('ZIP file detected, using file upload endpoint');
                    
                    // Create form data
                    const formData = new FormData();
                    formData.append('configFile', file);
                    formData.append('prompt', prompt);
                    
                    // Use the analyze-config endpoint for ZIP files
                    const response = await fetch('/api/analyze-config', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    
                    result = await response.json();
                    
                    // If it's an analysis result, display it differently
                    if (result.analysis) {
                        displayAnalysisResults(result);
                        loadingIndicator.style.display = 'none';
                        generateBtn.disabled = false;
                        return;
                    }
                } else {
                    // For non-ZIP files, append the file content to the prompt
                    const enhancedPrompt = `${prompt}\n\nHere is my existing configuration file (${fileName}):\n\`\`\`\n${fileContent}\n\`\`\``;
                    
                    console.log('Sending enhanced prompt with file content');
                    
                    // Make API request with the enhanced prompt
                    const response = await fetch('/api/process-prompt', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ prompt: enhancedPrompt }),
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    
                    result = await response.json();
                }
            } else {
                // No file uploaded, use the standard process-prompt endpoint
                console.log('No file uploaded, using standard prompt');
                
                const response = await fetch('/api/process-prompt', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt: prompt }),
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                result = await response.json();
            }
            
            console.log('API response:', result);
            
            if (result.needsClarification) {
                // Show clarification UI
                clarificationMessage.textContent = result.message;
                clarificationSection.style.display = 'block';
                resultsSection.style.display = 'none';
            } else {
                // Show results
                displayFiles(result.files);
                clarificationSection.style.display = 'none';
                resultsSection.style.display = 'block';
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while processing your request: ' + error.message);
        } finally {
            loadingIndicator.style.display = 'none';
            generateBtn.disabled = false;
        }
    });

    // Handle clarification submission
    submitClarificationBtn.addEventListener('click', function() {
        const clarificationText = clarificationInput.value.trim();
        
        if (!clarificationText) {
            alert('Please provide the requested information.');
            return;
        }
        
        // Store clarification
        promptHistory.clarification = clarificationText;
        
        // Combine original prompt with clarification
        const combinedPrompt = `${promptHistory.originalPrompt}\n\nAdditional information: ${promptHistory.clarification}`;
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        submitClarificationBtn.disabled = true;
        
        // Make API request with combined prompt
        fetch('/api/process-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: combinedPrompt }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            console.log('API response after clarification:', result);
            
            if (result.needsClarification) {
                // Still need clarification
                clarificationMessage.textContent = result.message;
                clarificationInput.value = '';
            } else {
                // Show results
                displayFiles(result.files);
                clarificationSection.style.display = 'none';
                resultsSection.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while processing your request: ' + error.message);
        })
        .finally(() => {
            loadingIndicator.style.display = 'none';
            submitClarificationBtn.disabled = false;
        });
    });
    
    // Handle Red Team button click
    redTeamBtn.addEventListener('click', async function() {
        // Hide any existing team suggestions
        blueTeamSuggestions.style.display = 'none';
        redTeamSuggestions.style.display = 'none';
        
        const prompt = promptInput.value.trim();
        
        if (!prompt) {
            alert('Please enter your environment requirements first.');
            return;
        }
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        redTeamBtn.disabled = true;
        
        try {
            // Check if a file is uploaded
            const fileInput = document.getElementById('configUpload');
            const file = fileInput.files[0];
            
            // Prepare the request for red team suggestions
            let redTeamPrompt;
            
            if (file) {
                if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
                    // For ZIP files
                    const formData = new FormData();
                    formData.append('configFile', file);
                    formData.append('prompt', `${prompt}\n\nGenerate red team suggestions to make this environment inherently vulnerable for testing purposes.`);
                    
                    console.log('Sending ZIP file to analyze-config endpoint for red team analysis');
                    const response = await fetch('/api/analyze-config', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    displayRedTeamSuggestions(result.suggestions);
                } else {
                    // For single files
                    const fileContent = await readFileAsText(file);
                    redTeamPrompt = `${prompt}\n\nHere is my existing configuration file (${file.name}):\n\`\`\`\n${fileContent}\n\`\`\`\n\nGenerate red team suggestions to make this environment inherently vulnerable for testing purposes.`;
                    
                    await fetchRedTeamSuggestions(redTeamPrompt);
                }
            } else {
                // No file uploaded
                redTeamPrompt = `${prompt}\n\nGenerate red team suggestions to make this environment inherently vulnerable for testing purposes.`;
                
                await fetchRedTeamSuggestions(redTeamPrompt);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while processing your request: ' + error.message);
        } finally {
            loadingIndicator.style.display = 'none';
            redTeamBtn.disabled = false;
        }
    });

    // Handle Blue Team button click
    blueTeamBtn.addEventListener('click', async function() {
        // Hide any existing team suggestions
        redTeamSuggestions.style.display = 'none';
        blueTeamSuggestions.style.display = 'none';
        
        const prompt = promptInput.value.trim();
        
        if (!prompt) {
            alert('Please enter your environment requirements first.');
            return;
        }
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        blueTeamBtn.disabled = true;
        
        try {
            // Check if a file is uploaded
            const fileInput = document.getElementById('configUpload');
            const file = fileInput.files[0];
            
            // Prepare the request for blue team suggestions
            let blueTeamPrompt;
            
            if (file) {
                if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
                    // For ZIP files
                    const formData = new FormData();
                    formData.append('configFile', file);
                    formData.append('prompt', `${prompt}\n\nGenerate blue team suggestions to add threat hunting and detection visibility to this environment.`);
                    
                    console.log('Sending ZIP file to analyze-config endpoint for blue team analysis');
                    const response = await fetch('/api/analyze-config', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    displayBlueTeamSuggestions(result.suggestions);
                } else {
                    // For single files
                    const fileContent = await readFileAsText(file);
                    blueTeamPrompt = `${prompt}\n\nHere is my existing configuration file (${file.name}):\n\`\`\`\n${fileContent}\n\`\`\`\n\nGenerate blue team suggestions to add threat hunting and detection visibility to this environment.`;
                    
                    await fetchBlueTeamSuggestions(blueTeamPrompt);
                }
            } else {
                // No file uploaded
                blueTeamPrompt = `${prompt}\n\nGenerate blue team suggestions to add threat hunting and detection visibility to this environment.`;
                
                await fetchBlueTeamSuggestions(blueTeamPrompt);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while processing your request: ' + error.message);
        } finally {
            loadingIndicator.style.display = 'none';
            blueTeamBtn.disabled = false;
        }
    });

    // Fetch Red Team suggestions
    async function fetchRedTeamSuggestions(prompt) {
        console.log('Fetching red team suggestions...');
        console.log('Sending data:', { prompt, teamType: 'red' });
        
        // Add a test call first to verify API connectivity
        try {
            const testResponse = await fetch('/api/test');
            if (testResponse.ok) {
                const testData = await testResponse.json();
                console.log('API test endpoint responded:', testData);
            } else {
                console.error('API test endpoint failed with status:', testResponse.status);
            }
        } catch (testError) {
            console.error('Error connecting to test endpoint:', testError);
        }
        
        try {
            const response = await fetch('/api/process-prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    prompt: prompt,
                    teamType: 'red'
                }),
            });
            
            console.log('Red team response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response text:', errorText);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Red team API response:', result);
            
            if (result.needsClarification) {
                alert(result.message);
                return;
            }
            
            // Display suggestions if available
            if (result.suggestions && result.suggestions.length > 0) {
                displayRedTeamSuggestions(result.suggestions);
            } else {
                // Create default suggestions if none provided
                console.log('No suggestions returned, using defaults');
                const defaultSuggestions = [
                    "Configure services with default or weak credentials",
                    "Disable Windows Defender and other security controls",
                    "Add vulnerable software versions with known CVEs",
                    "Configure permissive firewall rules",
                    "Create overprivileged user accounts",
                    "Disable audit logging and monitoring",
                    "Include vulnerable web applications for exploitation practice"
                ];
                displayRedTeamSuggestions(defaultSuggestions);
            }
        } catch (error) {
            console.error('Error fetching red team suggestions:', error);
            throw error; // Re-throw to be handled by the caller
        }
    }

    // Fetch Blue Team suggestions
    async function fetchBlueTeamSuggestions(prompt) {
        console.log('Fetching blue team suggestions...');
        console.log('Sending data:', { prompt, teamType: 'blue' });
        
        try {
            const response = await fetch('/api/process-prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    prompt: prompt,
                    teamType: 'blue'
                }),
            });
            
            console.log('Blue team response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response text:', errorText);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Blue team API response:', result);
            
            if (result.needsClarification) {
                alert(result.message);
                return;
            }
            
            // Display suggestions if available
            if (result.suggestions && result.suggestions.length > 0) {
                displayBlueTeamSuggestions(result.suggestions);
            } else {
                // Create default suggestions if none provided
                console.log('No suggestions returned, using defaults');
                const defaultSuggestions = [
                    "Deploy Wazuh SIEM for centralized logging and monitoring",
                    "Add Sysmon for enhanced Windows event logging",
                    "Configure Windows Event Forwarding (WEF)",
                    "Implement log aggregation with Elastic Stack",
                    "Add network traffic monitoring with Zeek/Suricata",
                    "Configure audit policies for enhanced visibility",
                    "Add honeypot services to detect lateral movement"
                ];
                displayBlueTeamSuggestions(defaultSuggestions);
            }
        } catch (error) {
            console.error('Error fetching blue team suggestions:', error);
            throw error; // Re-throw to be handled by the caller
        }
    }

    // Display Red Team suggestions
    function displayRedTeamSuggestions(suggestions) {
        redTeamSuggestionItems = [...suggestions];
        redTeamSuggestionsList.innerHTML = '';
        
        suggestions.forEach(suggestion => {
            const listItem = document.createElement('div');
            listItem.className = 'alert alert-danger';
            listItem.textContent = suggestion;
            redTeamSuggestionsList.appendChild(listItem);
        });
        
        redTeamSuggestions.style.display = 'block';
        
        // Scroll to the suggestions
        redTeamSuggestions.scrollIntoView({ behavior: 'smooth' });
    }

    // Display Blue Team suggestions
    function displayBlueTeamSuggestions(suggestions) {
        blueTeamSuggestionItems = [...suggestions];
        blueTeamSuggestionsList.innerHTML = '';
        
        suggestions.forEach(suggestion => {
            const listItem = document.createElement('div');
            listItem.className = 'alert alert-info';
            listItem.textContent = suggestion;
            blueTeamSuggestionsList.appendChild(listItem);
        });
        
        blueTeamSuggestions.style.display = 'block';
        
        // Scroll to the suggestions
        blueTeamSuggestions.scrollIntoView({ behavior: 'smooth' });
    }

    // Handle Red Team "Yes" button click
    redTeamYesBtn.addEventListener('click', function() {
        redTeamCheckboxes.innerHTML = '';
        
        redTeamSuggestionItems.forEach((suggestion, index) => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'form-check';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input';
            checkbox.id = `redTeamOption${index}`;
            checkbox.value = suggestion;
            
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = `redTeamOption${index}`;
            label.textContent = suggestion;
            
            checkboxDiv.appendChild(checkbox);
            checkboxDiv.appendChild(label);
            redTeamCheckboxes.appendChild(checkboxDiv);
        });
        
        redTeamSelectionArea.style.display = 'block';
    });

    // Handle Blue Team "Yes" button click
    blueTeamYesBtn.addEventListener('click', function() {
        blueTeamCheckboxes.innerHTML = '';
        
        blueTeamSuggestionItems.forEach((suggestion, index) => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'form-check';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input';
            checkbox.id = `blueTeamOption${index}`;
            checkbox.value = suggestion;
            
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = `blueTeamOption${index}`;
            label.textContent = suggestion;
            
            checkboxDiv.appendChild(checkbox);
            checkboxDiv.appendChild(label);
            blueTeamCheckboxes.appendChild(checkboxDiv);
        });
        
        blueTeamSelectionArea.style.display = 'block';
    });

    // Handle Red Team "No" button click
    redTeamNoBtn.addEventListener('click', function() {
        redTeamSuggestions.style.display = 'none';
    });

    // Handle Blue Team "No" button click
    blueTeamNoBtn.addEventListener('click', function() {
        blueTeamSuggestions.style.display = 'none';
    });

    // Handle Implement Red Team button click
    implementRedTeamBtn.addEventListener('click', async function() {
        const selectedSuggestions = [];
        
        // Get all checked options
        redTeamCheckboxes.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            selectedSuggestions.push(checkbox.value);
        });
        
        if (selectedSuggestions.length === 0) {
            alert('Please select at least one option to implement.');
            return;
        }
        
        // Implement selected Red Team features
        await implementTeamFeatures('red', selectedSuggestions);
    });

    // Handle Implement Blue Team button click
    implementBlueTeamBtn.addEventListener('click', async function() {
        const selectedSuggestions = [];
        
        // Get all checked options
        blueTeamCheckboxes.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            selectedSuggestions.push(checkbox.value);
        });
        
        if (selectedSuggestions.length === 0) {
            alert('Please select at least one option to implement.');
            return;
        }
        
        // Implement selected Blue Team features
        await implementTeamFeatures('blue', selectedSuggestions);
    });

    // Implement selected team features
    async function implementTeamFeatures(teamType, selectedSuggestions) {
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        
        // Disable buttons during processing
        if (teamType === 'red') {
            implementRedTeamBtn.disabled = true;
        } else {
            implementBlueTeamBtn.disabled = true;
        }
        
        try {
            const prompt = promptInput.value.trim();
            const teamPrompt = teamType === 'red' 
                ? `${prompt}\n\nImplement the following red team features to make this environment inherently vulnerable:\n${selectedSuggestions.join('\n')}`
                : `${prompt}\n\nImplement the following blue team features to add threat hunting and detection capabilities:\n${selectedSuggestions.join('\n')}`;
            
            // Check if a file is uploaded
            const fileInput = document.getElementById('configUpload');
            const file = fileInput.files[0];
            
            let result;
            
            if (file) {
                if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
                    // For ZIP files
                    const formData = new FormData();
                    formData.append('configFile', file);
                    formData.append('prompt', teamPrompt);
                    
                    console.log('Sending ZIP file to analyze-config endpoint for implementation');
                    const response = await fetch('/api/analyze-config', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    
                    result = await response.json();
                } else {
                    // For single files
                    const fileContent = await readFileAsText(file);
                    const enhancedPrompt = `${teamPrompt}\n\nHere is my existing configuration file (${file.name}):\n\`\`\`\n${fileContent}\n\`\`\``;
                    
                    console.log('Sending file content with prompt for implementation');
                    const response = await fetch('/api/process-prompt', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ prompt: enhancedPrompt }),
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    
                    result = await response.json();
                }
            } else {
                // No file uploaded
                console.log('Sending prompt for implementation without file');
                const response = await fetch('/api/process-prompt', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt: teamPrompt }),
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                result = await response.json();
            }
            
            // Display the results
            if (result.files && result.files.length > 0) {
                // Hide the suggestion panels
                redTeamSuggestions.style.display = 'none';
                blueTeamSuggestions.style.display = 'none';
                
                // Show the results
                displayFiles(result.files);
                resultsSection.style.display = 'block';
                resultsSection.scrollIntoView({ behavior: 'smooth' });
            } else if (result.needsClarification) {
                alert(result.message);
            } else {
                alert('No configuration files were generated. Please try again with more specific requirements.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while implementing features: ' + error.message);
        } finally {
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
            
            // Re-enable buttons
            if (teamType === 'red') {
                implementRedTeamBtn.disabled = false;
            } else {
                implementBlueTeamBtn.disabled = false;
            }
        }
    }
    
    // Handle download all button
    downloadAllBtn.addEventListener('click', downloadAllFiles);
    
    // Add console log to verify that the script loaded
    console.log('LudusRange Generator app.js loaded successfully');
});

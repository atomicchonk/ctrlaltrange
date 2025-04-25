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

    // Store original prompt and any clarification info for final submission
    let promptHistory = {
        originalPrompt: '',
        clarification: ''
    };

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
    
    // Create file download cards in the UI
    function displayFiles(files) {
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
    
    // Helper function to download a whole role as a "zip" (simulated)
    function downloadRoleAsZip(roleName, files) {
        // In a real implementation, this would create a zip file
        // For now, we'll download each file individually
        files.forEach(file => {
            downloadFile(file.name, file.content);
        });
        
        alert(`Downloading all files for role: ${roleName}\n\nIn a production version, this would create a zip file.`);
    }

    // Handle generate button click
    generateBtn.addEventListener('click', function() {
        console.log('Generate button clicked');
        const prompt = promptInput.value.trim();
        
        if (!prompt) {
            alert('Please enter your requirements first.');
            return;
        }
        
        // Store original prompt
        promptHistory.originalPrompt = prompt;
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        generateBtn.disabled = true;
        
        // Make API request
        fetch('/api/process-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
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
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while processing your request: ' + error.message);
        })
        .finally(() => {
            loadingIndicator.style.display = 'none';
            generateBtn.disabled = false;
        });
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
    
    // Add console log to verify that the script loaded
    console.log('LudusRange Generator app.js loaded successfully');
});

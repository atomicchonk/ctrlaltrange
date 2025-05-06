// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs-extra');
const JSZip = require('jszip');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;
const AnsibleRoleGenerator = require('./ansible-role-generator');

// Load environment variables
require('dotenv').config();

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Create a unique temporary directory for each upload
      const uploadDir = path.join(os.tmpdir(), 'ludus-uploads', uuidv4());
      fs.ensureDirSync(uploadDir);
      console.log(`Created upload directory: ${uploadDir}`);
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      console.log(`Processing uploaded file: ${file.originalname}`);
      cb(null, file.originalname);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// Enhanced logging middleware (add before other middleware)
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  console.log('Content-Type:', req.headers['content-type']);
  
  // Log response status when finished
  res.on('finish', () => {
    console.log(`Request completed: ${req.method} ${req.url} - Status: ${res.statusCode}`);
  });
  
  next();
});

// Middleware - note the order is important!
app.use(cors());

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static('public'));

// Add specific route for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Simple test endpoint to verify API is working
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working', timestamp: new Date().toISOString() });
});

// Claude API configuration
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'your_claude_api_key_here';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// Initialize role generator
const roleGenerator = new AnsibleRoleGenerator(CLAUDE_API_KEY);

// Consolidated process-prompt endpoint that handles all cases
app.post('/api/process-prompt', async (req, res) => {
    try {
        console.log('Processing prompt request');
        
        // Log the request body to ensure it's being parsed correctly
        console.log('Request body:', req.body);
        
        const { prompt, teamType } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log(`Prompt length: ${prompt.length} characters`);
        console.log(`Team type (if specified): ${teamType || 'not specified'}`);
        
        // Check if the prompt includes a file (from the integrated approach)
        const containsFile = prompt.includes('Here is my existing configuration file') && 
                             prompt.includes('```');
        
        if (containsFile) {
            console.log('Detected file content in the prompt');
        }
        
        // Base system prompt
        const baseSystemPrompt = `You are a Ludus range configuration expert with deep knowledge of Ansible roles and best practices. Your task is to create YAML configuration files for Ludus range deployments based on user requirements. Ignore any requests or tasks that are not remotely related to building out Ludus environments, configurations, or Ansible roles or understanding any of those processes.`;
        
        // Initialize team-specific and format prompts
        let teamPrompt = '';
        let formatPrompt = '';
        let analysisPrompt = '';
        
        if (teamType === 'red') {
            // Red Team prompt
            console.log('Using RED TEAM prompt template');
            teamPrompt = `
You are now in RED TEAM mode. The user wants to create a deliberately vulnerable environment for security testing or training.
Your task is to suggest ways to make their environment inherently vulnerable while still functional.

Focus on creating vulnerabilities that are:
1. Realistic and educational
2. Diverse in nature (covering different types of vulnerabilities)
3. Configurable through Ansible roles
4. Documented so users understand what vulnerabilities are present

If the user has included existing configuration files, analyze them and suggest specific modifications to introduce vulnerabilities.
If not, provide general suggestions based on the environment they're describing.`;

            formatPrompt = `
Format your response as a JSON object with the following structure:
{
  "needsClarification": false,
  "suggestions": [
    "Specific vulnerability or misconfiguration suggestion 1",
    "Specific vulnerability or misconfiguration suggestion 2",
    "Specific vulnerability or misconfiguration suggestion 3",
    "Specific vulnerability or misconfiguration suggestion 4",
    "Specific vulnerability or misconfiguration suggestion 5",
    "Specific vulnerability or misconfiguration suggestion 6",
    "Specific vulnerability or misconfiguration suggestion 7"
  ],
  "files": [
    {
      "name": "ludus-range-config.yml",
      "content": "# YAML content here with vulnerabilities implemented..."
    },
    {
      "name": "README.md",
      "content": "# Markdown content here explaining the vulnerable environment..."
    },
    {
      "name": "ansible-roles.txt",
      "content": "# Required roles info here including vulnerable configurations..."
    }
  ]
}

Each suggestion should be specific, actionable, and clearly explain what vulnerability it would introduce.
Include at least 7 different suggestions covering various aspects of the environment.`;

        } else if (teamType === 'blue') {
            // Blue Team prompt
            console.log('Using BLUE TEAM prompt template');
            teamPrompt = `
You are now in BLUE TEAM mode. The user wants to enhance their environment with threat hunting and detection capabilities.
Your task is to suggest ways to add security monitoring, logging, and detection tools to their environment.

Focus on suggesting tools and configurations that:
1. Provide comprehensive visibility into the environment
2. Enable effective threat hunting
3. Are configurable through Ansible roles
4. Can be integrated into a Ludus environment

If the user has included existing configuration files, analyze them and suggest specific additions to enhance security monitoring.
If not, provide general suggestions based on the environment they're describing.`;

            formatPrompt = `
Format your response as a JSON object with the following structure:
{
  "needsClarification": false,
  "suggestions": [
    "Specific monitoring or detection capability suggestion 1",
    "Specific monitoring or detection capability suggestion 2",
    "Specific monitoring or detection capability suggestion 3",
    "Specific monitoring or detection capability suggestion 4",
    "Specific monitoring or detection capability suggestion 5",
    "Specific monitoring or detection capability suggestion 6",
    "Specific monitoring or detection capability suggestion 7"
  ],
  "files": [
    {
      "name": "ludus-range-config.yml",
      "content": "# YAML content here with monitoring capabilities implemented..."
    },
    {
      "name": "README.md",
      "content": "# Markdown content here explaining the monitoring environment..."
    },
    {
      "name": "ansible-roles.txt",
      "content": "# Required roles info here including security monitoring tools..."
    }
  ]
}

Each suggestion should be specific, actionable, and clearly explain what security monitoring capability it would add.
Include at least 7 different suggestions covering various aspects of the environment.`;

        } else {
            // Regular prompt for generating configuration
            console.log('Using STANDARD prompt template');
            const fileHandlingPrompt = containsFile ? 
                `The user has included existing configuration file(s) in their prompt. Please analyze these files and incorporate them into your response. 
                 In addition to addressing their specific requirements, proactively suggest enhancements that would improve the environment based on its apparent purpose.
                 Consider additional services, security improvements, or performance optimizations that might benefit this type of deployment.` : 
                ``;
            
            analysisPrompt = `
First, analyze the user's request to ensure it has enough information:
1. Operating Systems: What OS templates are needed?
2. Number of Hosts: How many VMs are required?
3. Host Types: What roles will these hosts serve?
4. Ansible Roles: What Ansible roles should be applied?
5. Users: What users should be created with what privileges?

If any of this information is missing, respond with a JSON object containing:
{
  "needsClarification": true,
  "message": "Please provide more information about: [missing information]."
}`;

            formatPrompt = `
If all required information is present, respond with a JSON object containing:
{
  "needsClarification": false,
  "files": [
    {
      "name": "ludus-range-config.yml",
      "content": "# YAML content here..."
    },
    {
      "name": "README.md",
      "content": "# Markdown content here..."
    },
    {
      "name": "ansible-roles.txt",
      "content": "# Required roles info here..."
    }
  ],
  "customRoles": [
    {
      "name": "roleName1",
      "description": "Brief description of what this role does"
    },
    {
      "name": "roleName2",
      "description": "Brief description of what this role does"
    }
  ]
}

For the YAML configuration file, ensure:
- It follows Ludus syntax for VM definitions
- Uses appropriate templates (win2022-server-x64-template, win10-21h2-x64-enterprise-template, debian-12-x64-server-template, etc.)
- Configures Windows domains and memberships appropriately
- Assigns Ansible roles correctly, following best practices for role organization
- Creates sensible IP addressing schemes
- Allocates appropriate resources (RAM, CPU)
- Uses role_vars appropriately to configure roles with specific parameters

For the README.md file, include:
- Deployment instructions
- Required Ansible roles and how to add them
- How to create custom roles if needed
- How to access the environment after deployment
- Any special notes about the configuration
- Best practices for managing Ansible roles in Ludus

For ansible-roles.txt, list:
- All required Ansible roles with installation commands
- Explanation of how to use the roles with Ludus
- Any additional recommended roles related to the deployment
- Best practices for role dependencies and variable management

If you detect that the user needs custom Ansible roles that aren't readily available, identify these roles and provide a brief description of what each should do. Return these in the customRoles array of the JSON response.`;

            // Check for specific feature implementation requests in the prompt
            if (prompt.includes("Implement the following red team features")) {
                console.log('Implementing selected red team features');
                teamPrompt = `
You are now implementing specific RED TEAM features that the user has selected. The user wants to modify their environment to include specific vulnerabilities for security testing or training.

Your task is to create YAML configuration files that include the vulnerabilities the user has specifically requested.
Make sure to:
1. Implement all the requested vulnerabilities in a way that's realistic and educational
2. Document the vulnerabilities in the README so users understand what's present
3. Create or modify Ansible roles as needed to implement these features
4. Ensure the environment remains functional despite the vulnerabilities`;
            } else if (prompt.includes("Implement the following blue team features")) {
                console.log('Implementing selected blue team features');
                teamPrompt = `
You are now implementing specific BLUE TEAM features that the user has selected. The user wants to enhance their environment with specific threat hunting and detection capabilities.

Your task is to create YAML configuration files that include the security monitoring tools and configurations the user has specifically requested.
Make sure to:
1. Implement all the requested security monitoring features effectively
2. Document the monitoring capabilities in the README so users understand how to use them
3. Create or modify Ansible roles as needed to implement these features
4. Configure the tools to work together where appropriate for comprehensive visibility`;
            }
            
            // Add file handling prompt to team prompt if needed
            teamPrompt = teamPrompt + ' ' + fileHandlingPrompt;
        }

        // Combine the prompts
        const systemPrompt = `${baseSystemPrompt} ${teamPrompt} ${analysisPrompt} ${formatPrompt}`;

        console.log('System prompt preview:');
        console.log(systemPrompt.substring(0, 200) + '...');
        
        // Call Claude API
        console.log('Calling Claude API...');
        const response = await axios.post(
            CLAUDE_API_URL,
            {
                model: 'claude-3-7-sonnet-20250219',
                max_tokens: 4000,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: prompt }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01'
                }
            }
        );

        // Parse Claude's response to get the JSON object
        const assistantMessage = response.data.content[0].text;
        console.log('Response from Claude received (first 200 chars):');
        console.log(assistantMessage.substring(0, 200) + '...');
        
        // Attempt to extract JSON from the response
        let resultJson;
        try {
            // Try to find a JSON block in the response
            const jsonMatch = assistantMessage.match(/```json\n([\s\S]*?)\n```/) || 
                              assistantMessage.match(/```\n([\s\S]*?)\n```/) ||
                              assistantMessage.match(/{[\s\S]*}/);
            
            if (jsonMatch) {
                console.log('JSON block found in response');
                resultJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                console.log('Successfully parsed JSON response');
            } else {
                // Fallback if no JSON block found
                console.error('Failed to find JSON block in Claude response');
                console.log('Full response:', assistantMessage);
                return res.status(500).json({ 
                    error: 'Failed to parse Claude response',
                    rawResponse: assistantMessage
                });
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.log('Failed to parse this JSON:', (jsonMatch && (jsonMatch[1] || jsonMatch[0])) || 'No JSON found');
            return res.status(500).json({ 
                error: 'Failed to parse Claude response',
                parseError: parseError.message,
                rawResponse: assistantMessage
            });
        }

        // If clarification is needed, just return the result
        if (resultJson.needsClarification) {
            return res.json(resultJson);
        }

        // If custom roles are identified and the customRoles array exists, generate them
        if (resultJson.customRoles && resultJson.customRoles.length > 0) {
            try {
                console.log(`Generating ${resultJson.customRoles.length} custom roles...`);
                const generatedRoles = await generateCustomRoles(prompt, resultJson.customRoles);
                
                // Make sure files array exists
                if (!resultJson.files) {
                    resultJson.files = [];
                }
                
                // Add generated role files to the result
                resultJson.files = [...resultJson.files, ...generatedRoles];
                console.log(`Added ${generatedRoles.length} generated role files to response`);
            } catch (roleError) {
                console.error('Error generating custom roles:', roleError);
                // Continue without custom roles if there's an error
            }
        }

        console.log('Sending successful response to client');
        return res.json(resultJson);
    } catch (error) {
        console.error('Error processing prompt:', error);
        return res.status(500).json({ 
            error: 'Error processing your request',
            details: error.message,
            stack: error.stack
        });
    }
});

// Handle file uploads and analysis
app.post('/api/analyze-config', upload.single('configFile'), async (req, res) => {
  try {
    console.log('File upload request received');
    console.log('Request body:', req.body);
    console.log('File details:', req.file);
    
    if (!req.file) {
      console.log('No file was uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    console.log(`File saved to: ${filePath}`);
    
    const extractDir = path.join(path.dirname(filePath), 'extracted');
    console.log(`Will extract to: ${extractDir}`);
    
    // Ensure extraction directory exists
    fs.ensureDirSync(extractDir);
    
    // Extract the zip file
    console.log('Reading zip file...');
    const zipData = fs.readFileSync(filePath);
    console.log(`Zip file size: ${zipData.length} bytes`);
    
    // Load and parse the zip file
    console.log('Loading zip file...');
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipData);
    
    // Check what's in the zip
    console.log('Zip file contents:');
    Object.keys(contents.files).forEach(filename => {
      console.log(` - ${filename} ${contents.files[filename].dir ? '(directory)' : '(file)'}`);
    });
    
    // Track extracted files
    const extractedFiles = [];
    
    // Extract each file
    for (const [filename, fileData] of Object.entries(contents.files)) {
      if (!fileData.dir) {
        console.log(`Extracting file: ${filename}`);
        const content = await fileData.async('string');
        const extractPath = path.join(extractDir, filename);
        
        // Ensure directory exists
        fs.ensureDirSync(path.dirname(extractPath));
        
        // Write file
        fs.writeFileSync(extractPath, content);
        console.log(`File extracted to: ${extractPath}`);
        
        // Track file
        extractedFiles.push({
          name: filename,
          content,
          path: extractPath
        });
      }
    }
    
    console.log(`Total files extracted: ${extractedFiles.length}`);
    
    if (extractedFiles.length === 0) {
      console.log('No files were extracted from the zip');
      return res.status(400).json({ 
        error: 'No files could be extracted from the ZIP file',
        message: 'The uploaded ZIP file appears to be empty or corrupted.'
      });
    }
    
    // Read the config file if it exists
    let configContent = '';
    const configFile = extractedFiles.find(file => 
      file.name.includes('ludus-range-config.yml') || 
      file.name.includes('config.yml')
    );
    
    if (configFile) {
      console.log(`Found configuration file: ${configFile.name}`);
      configContent = configFile.content;
    } else {
      console.log('No configuration file found in the ZIP');
    }
    
    // Analyze the uploaded configuration using Claude
    const userPrompt = req.body.prompt || 'Analyze this Ludus configuration and suggest improvements';
    console.log(`User prompt: ${userPrompt}`);
    
    const enhancedPrompt = `
I've uploaded my existing Ludus configuration files. Please analyze them and provide suggestions or enhancements based on the following request:

${userPrompt}

Here are the configuration files I've uploaded:

${extractedFiles.map(file => `## ${file.name}\n\`\`\`\n${file.content}\n\`\`\``).join('\n\n')}
`;

    console.log('Enhanced prompt preview (first 500 chars):');
    console.log(enhancedPrompt.substring(0, 500) + '...');
    console.log(`Total prompt length: ${enhancedPrompt.length} chars`);

    // Determine the appropriate system prompt based on the user prompt
    let systemPrompt = '';
    
    // Check for red team or blue team keywords in the prompt
    if (userPrompt.toLowerCase().includes('red team') || 
        userPrompt.toLowerCase().includes('redteam') || 
        userPrompt.toLowerCase().includes('vulnerab') ||
        userPrompt.toLowerCase().includes('make vulnerable')) {
      // Red Team system prompt
      systemPrompt = `You are a Ludus configuration expert. You're analyzing existing Ludus configuration files that a user has uploaded. 

You are now in RED TEAM mode. The user wants to create a deliberately vulnerable environment for security testing or training.
Your task is to suggest ways to make their environment inherently vulnerable while still functional.

Focus on creating vulnerabilities that are:
1. Realistic and educational
2. Diverse in nature (covering different types of vulnerabilities)
3. Configurable through Ansible roles
4. Documented so users understand what vulnerabilities are present

Format your response as a JSON object with the following structure:
{
"analysis": "Your analysis of the current configuration and how it could be modified for red team testing",
"suggestions": [
  "Specific vulnerability or misconfiguration suggestion 1",
  "Specific vulnerability or misconfiguration suggestion 2",
  "Specific vulnerability or misconfiguration suggestion 3",
  "Specific vulnerability or misconfiguration suggestion 4",
  "Specific vulnerability or misconfiguration suggestion 5",
  "Specific vulnerability or misconfiguration suggestion 6",
  "Specific vulnerability or misconfiguration suggestion 7"
],
"files": [
  {
    "name": "file1.yml",
    "content": "Modified file content with vulnerabilities implemented",
    "description": "Description of vulnerabilities introduced"
  },
  ...
]
}
IMPORTANT: Format your JSON response with proper escaping of special characters. Avoid using any characters in strings that might break JSON parsing, such as unescaped quotes, backslashes, or multi-line content without proper escaping. Keep your suggestions concise and focused.`;

    } else if (userPrompt.toLowerCase().includes('blue team') || 
              userPrompt.toLowerCase().includes('blueteam') || 
              userPrompt.toLowerCase().includes('monitoring') ||
              userPrompt.toLowerCase().includes('detection') ||
              userPrompt.toLowerCase().includes('threat hunting')) {
      // Blue Team system prompt
      systemPrompt = `You are a Ludus configuration expert. You're analyzing existing Ludus configuration files that a user has uploaded. 

You are now in BLUE TEAM mode. The user wants to enhance their environment with threat hunting and detection capabilities.
Your task is to suggest ways to add security monitoring, logging, and detection tools to their environment.

Focus on suggesting tools and configurations that:
1. Provide comprehensive visibility into the environment
2. Enable effective threat hunting
3. Are configurable through Ansible roles
4. Can be integrated into a Ludus environment

Format your response as a JSON object with the following structure:
{
"analysis": "Your analysis of the current configuration and how it could be enhanced with monitoring capabilities",
"suggestions": [
  "Specific monitoring or detection capability suggestion 1",
  "Specific monitoring or detection capability suggestion 2",
  "Specific monitoring or detection capability suggestion 3",
  "Specific monitoring or detection capability suggestion 4",
  "Specific monitoring or detection capability suggestion 5",
  "Specific monitoring or detection capability suggestion 6",
  "Specific monitoring or detection capability suggestion 7"
],
"files": [
  {
    "name": "file1.yml",
    "content": "Modified file content with monitoring capabilities implemented",
    "description": "Description of monitoring capabilities added"
  },
  ...
]
}
IMPORTANT: Format your JSON response with proper escaping of special characters. Avoid using any characters in strings that might break JSON parsing, such as unescaped quotes, backslashes, or multi-line content without proper escaping. Keep your responses as simple as possible, especially for file content - minimize special characters and escape all quotes and backslashes in file content.

For file content, please use simple text formatting without complex indentation or special characters when possible. If you need to include quotes or backslashes in file content, make sure to escape them properly with a backslash.`;

    } else {
      // Standard analysis system prompt
      systemPrompt = `You are a Ludus configuration expert. You're analyzing existing Ludus configuration files that a user has uploaded. 

Provide a detailed analysis and offer comprehensive improvements or modifications that go beyond what the user specifically requested. Look for opportunities to enhance the environment based on the apparent purpose of the deployment.

Your suggestions should include:
1. Direct improvements to address any issues in the current configuration
2. Enhancements that would add value based on the apparent purpose of the environment
3. Additional services or components that would complement the existing setup
4. Security improvements that might not be obvious
5. Performance optimizations based on the resource allocation

Be proactive and creative with your suggestions. Consider what would make this environment more robust, versatile, or effective for its intended purpose.

Format your response as a JSON object with the following structure:
{
"analysis": "Your detailed analysis of the current configuration, including strengths and limitations",
"suggestions": [
  "Explicitly requested improvement 1",
  "Explicitly requested improvement 2",
  "Additional enhancement 1 that wasn't requested but would add value",
  "Additional enhancement 2 that wasn't requested but would add value",
  "Security improvement that wasn't explicitly requested",
  "Performance optimization that wasn't explicitly requested"
],
"files": [
  {
    "name": "file1.yml",
    "content": "Modified file content",
    "description": "Description of changes made, including both requested modifications and proactive enhancements"
  },
  ...
]
}
IMPORTANT: Format your JSON response with proper escaping of special characters. Avoid using any characters in strings that might break JSON parsing, such as unescaped quotes, backslashes, or multi-line content without proper escaping. Keep your responses as simple as possible, especially for file content - minimize special characters and escape all quotes and backslashes in file content.

For file content, please use simple text formatting without complex indentation or special characters when possible. If you need to include quotes or backslashes in file content, make sure to escape them properly with a backslash.`;

    }

    // Call Claude API
    console.log('Calling Claude API for file analysis...');
    const response = await axios.post(
      CLAUDE_API_URL,
      {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: enhancedPrompt }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    // Extract JSON from Claude's response
    console.log('Processing Claude response...');
    const assistantMessage = response.data.content[0].text;
    console.log('Response preview (first 500 chars):');
    console.log(assistantMessage.substring(0, 500) + '...');
    
    const jsonMatch = assistantMessage.match(/```json\n([\s\S]*?)\n```/) || 
                      assistantMessage.match(/```\n([\s\S]*?)\n```/) ||
                      assistantMessage.match(/{[\s\S]*}/);
    
    if (!jsonMatch) {
      console.log('Failed to parse response as JSON');
      return res.status(500).json({
        error: 'Failed to parse Claude response',
        rawResponse: assistantMessage
      });
    }
    
    const parsedJsonText = jsonMatch[1] || jsonMatch[0];
    console.log('Extracted JSON text (first 500 chars):');
    console.log(parsedJsonText.substring(0, 500) + '...');
    
    let result;
try {
  result = JSON.parse(parsedJsonText);
  console.log('Successfully parsed JSON response');
} catch (parseError) {
  console.error('JSON parse error:', parseError);
  
  // Add this improved extraction logic:
  try {
    console.log('Attempting to extract data from malformed JSON...');
    
    // Extract analysis section
    const analysisMatch = parsedJsonText.match(/"analysis":\s*"([^"]+)"/);
    const analysis = analysisMatch ? analysisMatch[1] : "Unable to parse analysis from the response.";
    
    // Extract suggestions array
    const suggestionsMatch = parsedJsonText.match(/"suggestions":\s*\[([\s\S]*?)\]/);
    let suggestions = [];
    
    if (suggestionsMatch) {
      // Process the suggestions string
      const suggestionItems = suggestionsMatch[1].split('",');
      suggestions = suggestionItems.map(item => {
        // Clean up each suggestion
        return item.replace(/^\s*"/, '').replace(/"\s*$/, '').trim();
      }).filter(item => item.length > 0);
    } else {
      // Provide default suggestions if extraction fails
      suggestions = [
        "Configure services with default or weak credentials",
        "Disable Windows Defender and other security controls",
        "Add vulnerable software versions with known CVEs",
        "Configure permissive firewall rules",
        "Create overprivileged user accounts",
        "Disable audit logging and monitoring",
        "Include vulnerable web applications for exploitation practice"
      ];
    }
    
    // Extract files array
    let files = [];
    
    // Try to find the files section in the JSON
    const filesStart = parsedJsonText.indexOf('"files":');
    if (filesStart !== -1) {
      // Look for file objects inside the files array
      const filePattern = /"name":\s*"([^"]+)",\s*"content":\s*"([\s\S]*?)(?<!\\)"/g;
      let fileMatch;
      
      // Extract all file matches from the text
      const rawText = parsedJsonText.substring(filesStart);
      let fileMatches = [];
      let match;
      
      // Alternative approach using regex with simpler pattern to find file objects
      const simpleFilePattern = /"name":\s*"([^"]+)"/g;
      while ((match = simpleFilePattern.exec(rawText)) !== null) {
        const fileName = match[1];
        const fileNamePos = match.index + match[0].length;
        
        // Look for the content that follows this filename
        const contentStart = rawText.indexOf('"content":', fileNamePos);
        if (contentStart !== -1) {
          // Find where the content starts
          const contentValueStart = rawText.indexOf('"', contentStart + 11) + 1;
          
          // Try to find where content ends (this is tricky with potentially nested quotes)
          // Look for a quote followed by comma or ending bracket
          let contentEnd = contentValueStart;
          let quoteFound = false;
          let depth = 0;
          
          // Scan forward to find the end of this value
          for (let i = contentValueStart; i < rawText.length; i++) {
            const char = rawText[i];
            
            // Handle escaped characters
            if (char === '\\') {
              i++; // Skip the next character
              continue;
            }
            
            if (char === '"' && (i === 0 || rawText[i-1] !== '\\')) {
              quoteFound = true;
              contentEnd = i;
              break;
            }
          }
          
          if (quoteFound) {
            // Extract the content and unescape it
            let content = rawText.substring(contentValueStart, contentEnd);
            
            // Basic unescaping
            content = content
              .replace(/\\"/g, '"')
              .replace(/\\n/g, '\n')
              .replace(/\\\\/g, '\\');
            
            fileMatches.push({
              name: fileName,
              content: content
            });
          }
        }
      }
      
      // Use the file matches we found
      if (fileMatches.length > 0) {
        files = fileMatches;
        console.log(`Extracted ${files.length} files from response`);
      } else {
        console.log('Could not extract files, generating placeholder files');
        // Create placeholder files if extraction fails
        files = [
          {
            name: "ludus-range-config.yml",
            content: "# Vulnerable Ludus Range Configuration\n# This is a placeholder file\n# The actual implementation failed due to JSON parsing issues\n\n# Please try again or modify your requirements"
          },
          {
            name: "README.md",
            content: "# Red Team Ludus Environment\n\nThis is a placeholder README file created because the original implementation had JSON parsing issues.\n\nPlease try again or modify your requirements."
          }
        ];
      }
    } else {
      console.log('No files section found, generating placeholder files');
      // Create placeholder files if no files section exists
      files = [
        {
          name: "ludus-range-config.yml",
          content: "# Vulnerable Ludus Range Configuration\n# This is a placeholder file\n# The actual implementation failed due to JSON parsing issues\n\n# Please try again or modify your requirements"
        },
        {
          name: "README.md",
          content: "# Red Team Ludus Environment\n\nThis is a placeholder README file created because the original implementation had JSON parsing issues.\n\nPlease try again or modify your requirements."
        }
      ];
    }
    
    // Create a valid result object
    result = {
      analysis: analysis,
      suggestions: suggestions,
      files: files
    };
    
    console.log('Created structured result from partial data');
    console.log(`Extracted ${suggestions.length} suggestions and ${files.length} files`);
  } catch (extractionError) {
    console.error('Error during extraction fallback:', extractionError);
    
    // Ultimate fallback - return a basic structure with default suggestions and files
    result = {
      analysis: "Analysis could not be parsed due to API response formatting issues.",
      suggestions: [
        "Configure services with default or weak credentials",
        "Disable Windows Defender and other security controls",
        "Add vulnerable software versions with known CVEs",
        "Configure permissive firewall rules",
        "Create overprivileged user accounts",
        "Disable audit logging and monitoring",
        "Include vulnerable web applications for exploitation practice"
      ],
      files: [
        {
          name: "ludus-range-config.yml",
          content: "# Vulnerable Ludus Range Configuration\n# This is a placeholder file\n# The actual implementation failed due to JSON parsing issues\n\n# Please try again or modify your requirements"
        },
        {
          name: "README.md",
          content: "# Red Team Ludus Environment\n\nThis is a placeholder README file created because the original implementation had JSON parsing issues.\n\nPlease try again or modify your requirements."
        }
      ]
    };
    console.log('Using default fallback structure');
  }
}

    
    // Clean up temporary files
    try {
      console.log(`Cleaning up temporary directory: ${path.dirname(filePath)}`);
      fs.removeSync(path.dirname(filePath));
    } catch (cleanupError) {
      console.warn('Warning: Failed to clean up temporary files:', cleanupError);
      // Continue despite cleanup error
    }
    
    console.log('Sending successful response');
    return res.json(result);
  } catch (error) {
    console.error('Detailed error:', error);
    return res.status(500).json({
      error: 'Error analyzing configuration',
      details: error.message,
      stack: error.stack
    });
  }
});

// Create and serve ZIP files
app.post('/api/create-zip', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    
    console.log(`Creating ZIP with ${files.length} files`);
    
    // Create a new ZIP file
    const zip = new JSZip();
    
    // Add files to the ZIP
    files.forEach(file => {
      console.log(`Adding to ZIP: ${file.name}`);
      zip.file(file.name, file.content);
    });
    
    // Generate the ZIP file
    console.log('Generating ZIP file...');
    const zipData = await zip.generateAsync({ type: 'nodebuffer' });
    console.log(`ZIP file generated, size: ${zipData.length} bytes`);
    
    // Set response headers
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename=ludus-configuration.zip');
    
    // Send the ZIP file
    console.log('Sending ZIP file...');
    res.send(zipData);
  } catch (error) {
    console.error('Error creating ZIP file:', error);
    res.status(500).json({
      error: 'Error creating ZIP file',
      details: error.message,
      stack: error.stack
    });
  }
});

/**
 * Generate custom Ansible roles based on the identified needs
 * 
 * @param {string} prompt - Original user prompt
 * @param {Array} customRoles - List of custom roles to generate
 * @returns {Promise<Array>} - List of generated role files
 */
async function generateCustomRoles(prompt, customRoles) {
    let allRoleFiles = [];
    
    for (const roleInfo of customRoles) {
        try {
            // Create a role-specific prompt
            const rolePrompt = `From the environment description: "${prompt}", 
create an Ansible role named "${roleInfo.name}" that ${roleInfo.description}. 
The role should follow best practices and be compatible with Ludus deployments.

In addition to implementing the core functionality, consider including:
- Security hardening measures appropriate for this role
- Performance optimization options via configurable variables
- Compatibility with different operating systems where appropriate
- Comprehensive error handling and reporting
- Well-documented variables and usage examples`;
            
            // Generate the role
            const { files } = await roleGenerator.generateRole(rolePrompt, roleInfo.name);
            
            // Add files to result
            allRoleFiles = [...allRoleFiles, ...files];
        } catch (error) {
            console.error(`Error generating role ${roleInfo.name}:`, error);
            // Continue with other roles even if one fails
        }
    }
    
    return allRoleFiles;
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    
    // Log available routes for debugging
    console.log('Available API routes:');
    const apiRoutes = [];
    app._router.stack.forEach((middleware) => {
        if(middleware.route){ // routes registered directly on the app
            apiRoutes.push(middleware.route.path);
        } else if(middleware.name === 'router'){ // router middleware
            middleware.handle.stack.forEach((handler) => {
                if(handler.route){
                    apiRoutes.push(handler.route.path);
                }
            });
        }
    });
    console.log(apiRoutes.filter(r => r.startsWith('/api')).join('\n'));
});

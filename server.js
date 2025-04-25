// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path'); // Add path module for file path handling
const app = express();
const port = process.env.PORT || 3000;
const AnsibleRoleGenerator = require('./ansible-role-generator');

// Load environment variables
require('dotenv').config();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Add specific route for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Claude API configuration
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'your_claude_api_key_here';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// Initialize role generator
const roleGenerator = new AnsibleRoleGenerator(CLAUDE_API_KEY);

// Endpoint to process the user's prompt with Claude
app.post('/api/process-prompt', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Construct the system prompt for Claude
        const systemPrompt = `You are a Ludus range configuration expert with deep knowledge of Ansible roles and best practices. Your task is to create YAML configuration files for Ludus range deployments based on user requirements.
        
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
}

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

        // Call Claude API
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
        
        // Attempt to extract JSON from the response
        let resultJson;
        try {
            // Try to find a JSON block in the response
            const jsonMatch = assistantMessage.match(/```json\n([\s\S]*?)\n```/) || 
                              assistantMessage.match(/```\n([\s\S]*?)\n```/) ||
                              assistantMessage.match(/{[\s\S]*}/);
            
            if (jsonMatch) {
                resultJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            } else {
                // Fallback if no JSON block found
                return res.status(500).json({ 
                    error: 'Failed to parse Claude response',
                    rawResponse: assistantMessage
                });
            }
        } catch (parseError) {
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

        // If custom roles are identified, generate them
        if (resultJson.customRoles && resultJson.customRoles.length > 0) {
            const generatedRoles = await generateCustomRoles(prompt, resultJson.customRoles);
            
            // Add generated role files to the result
            resultJson.files = [...resultJson.files, ...generatedRoles];
        }

        return res.json(resultJson);
    } catch (error) {
        console.error('Error processing prompt:', error);
        return res.status(500).json({ 
            error: 'Error processing your request',
            details: error.message
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
The role should follow best practices and be compatible with Ludus deployments.`;
            
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
});

// ansible-role-generator.js
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

/**
 * Ansible Role Generator
 * 
 * This module generates custom Ansible roles based on user prompts
 * using Claude AI to interpret requirements and create appropriate role files.
 */
class AnsibleRoleGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
    this.templateDir = path.join(__dirname, 'templates', 'role-templates');
  }

  /**
   * Generate an Ansible role based on user requirements
   * 
   * @param {string} prompt - User's description of desired role functionality
   * @param {string} roleName - Name for the new role
   * @returns {Promise<Object>} - Generated role files
   */
  async generateRole(prompt, roleName) {
    try {
      // Normalize role name (lowercase, hyphens instead of spaces)
      const normalizedRoleName = roleName.toLowerCase().replace(/\s+/g, '-');
      
      // Get AI-generated role content
      const roleContent = await this.generateRoleContent(prompt, normalizedRoleName);
      
      // Create directory structure and files
      const roleFiles = this.createRoleFiles(normalizedRoleName, roleContent);
      
      return {
        roleName: normalizedRoleName,
        files: roleFiles
      };
    } catch (error) {
      console.error('Error generating role:', error);
      throw new Error(`Failed to generate role: ${error.message}`);
    }
  }

  /**
   * Generate role content using Claude AI
   * 
   * @param {string} prompt - User's description of desired role functionality
   * @param {string} roleName - Normalized role name
   * @returns {Promise<Object>} - Generated role content for each file
   */
  async generateRoleContent(prompt, roleName) {
    try {
      const systemPrompt = `You are an expert Ansible developer specializing in creating well-structured, reusable roles. 
A user has requested an Ansible role with the following description: "${prompt}"

Create a complete Ansible role named "${roleName}" with all necessary files. Follow Ansible best practices:
1. Keep the role focused on a single responsibility
2. Use clear and descriptive task names
3. Employ variables with sensible defaults
4. Handle different operating systems where appropriate
5. Include proper error handling and idempotency
6. Add tags for selective execution
7. Use handlers for service management
8. Document the role thoroughly

Return a JSON object with the following structure:
{
  "files": {
    "tasks/main.yml": "yaml content...",
    "defaults/main.yml": "yaml content...",
    "handlers/main.yml": "yaml content...",
    "meta/main.yml": "yaml content...",
    "templates/config.j2": "template content...",
    "README.md": "markdown content..."
  },
  "description": "Brief description of what this role does"
}

Create only files that are necessary for the role's functionality. Ensure all YAML is valid.`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            { role: 'user', content: `Create an Ansible role for: ${prompt}` }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      // Extract JSON from Claude's response
      const assistantMessage = response.data.content[0].text;
      const jsonMatch = assistantMessage.match(/```json\n([\s\S]*?)\n```/) || 
                        assistantMessage.match(/```\n([\s\S]*?)\n```/) ||
                        assistantMessage.match(/{[\s\S]*}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to extract role content from AI response');
      }
      
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (error) {
      console.error('Error calling AI API:', error);
      throw new Error(`Failed to generate role content: ${error.message}`);
    }
  }

  /**
   * Create role directory structure and files
   * 
   * @param {string} roleName - Normalized role name
   * @param {Object} roleContent - Generated role content
   * @returns {Array} - List of generated files with their content
   */
  createRoleFiles(roleName, roleContent) {
    const roleFiles = [];
    
    // Extract file contents from AI response
    const { files, description } = roleContent;
    
    // Add each file to the result
    for (const [filePath, content] of Object.entries(files)) {
      roleFiles.push({
        name: `${roleName}/${filePath}`,
        content: content
      });
    }
    
    return roleFiles;
  }

  /**
   * Get directory structure for a standard Ansible role
   * 
   * @returns {Array} - List of directories in a standard role
   */
  static getStandardRoleStructure() {
    return [
      'tasks',
      'defaults',
      'handlers',
      'meta',
      'templates',
      'files',
      'vars',
      'tests'
    ];
  }
}

module.exports = AnsibleRoleGenerator;

# CTRL + ALT + RANGE

A web application that leverages Claude AI to generate Ludus range configuration files based on natural language prompts.

## Overview

This application allows users to describe their desired Ludus environment in natural language. The system processes the request through Claude AI, which generates the necessary configuration files for deploying a Ludus range that meets the specified requirements.

## Features

- Natural language input for describing Ludus environments
- AI-powered analysis of environment requirements
- Automatic generation of YAML configuration files
- Interactive clarification for incomplete requirements
- Downloadable configuration files and documentation

## Prerequisites

- Node.js (v14.x or later)
- npm (v6.x or later)
- A Claude API key (from Anthropic)
- Basic knowledge of Ludus and its deployment process

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/atomicchonk/ctrlaltrange.git
   cd ctrlaltrange
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with your Claude API key:
   ```
   CLAUDE_API_KEY=your_claude_api_key_here
   ```

4. Start the server:
   ```
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

1. **Describe Your Requirements**: Enter a detailed description of your desired Ludus environment, including:
   - Operating systems (Windows Server, Windows Client, Linux distributions)
   - Number of hosts needed
   - Types of hosts (domain controllers, member servers, workstations)
   - Ansible roles to apply
   - Users and their privileges
   - Any specific services or configurations needed

2. **Submit Your Request**: Click the "Generate Configuration" button to process your request.

3. **Provide Clarification (if needed)**: If your prompt lacks essential information, the system will ask for clarification.

4. **Download Configuration Files**: Once generated, you can download:
   - `ludus-range-config.yml`: The main Ludus configuration file
   - `README.md`: Deployment instructions and documentation
   - `ansible-roles.txt`: Information about required Ansible roles

5. **Deploy Your Environment**: Follow the instructions in the generated README file to deploy your Ludus environment.

## Example Prompts

### Basic Active Directory Environment

```
I need a Windows Active Directory environment with 1 Domain Controller running Windows Server 2022, 2 member servers running Windows Server 2019 with IIS installed, and 3 client workstations running Windows 10. Create a domain admin user named "admin" and a regular user named "user1". The domain should be named "corp.local".
```

### Security Testing Environment

```
Create a purple team testing environment with a Windows Server 2022 Domain Controller, 3 Windows 10 workstations joined to the domain, a Windows Server 2019 running vulnerable services for testing, and a Kali Linux attack machine. Include the Wazuh SIEM role on a separate Debian 12 server. Create domain admin "admin", and standard users "user1" and "user2".
```

### SCCM Deployment

```
I need an SCCM deployment with 1 Windows Server 2022 Domain Controller, 1 Windows Server 2022 SCCM Site Server, and 2 Windows 10 client machines. Use the synzack.ludus_sccm roles for deployment. Create a domain admin user "sccmadmin" with full rights to SCCM.
```

## Troubleshooting

- **API Key Issues**: Ensure your Claude API key is correctly set in the `.env` file.
- **Incomplete Responses**: If the application returns errors about parsing Claude's response, try providing more detailed prompts.
- **Server Connection Errors**: Check if your server is running correctly on port 3000.

## Connecting to a Production Claude API

For production use, you'll need to:

1. Update the authentication mechanism for Claude API requests
2. Implement rate limiting to manage API costs
3. Add error handling for API service interruptions
4. Consider caching common configurations to reduce API calls

## License

MIT License - See LICENSE file for details.

## Acknowledgments

- Ludus project (https://github.com/cisagov/Ludus)
- Synzack for the SCCM Ansible roles (https://github.com/Synzack/ludus_sccm)
- Anthropic for the Claude AI

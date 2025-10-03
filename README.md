# instruction-hub

A CLI tool to manage GitHub Copilot instructions from multiple repositories, including GitHub Enterprise.

Tired of manually copying and pasting instructions from various GitHub repositories? 

`instruction-hub` simplifies the process by allowing you to pull copilot instructions from any repo.

## Features

- 🏢 **GitHub Enterprise Support**: Works with private GitHub Enterprise repos as well as public GitHub (detects gh cli auth token)
- 🔐 **Automatic Authentication**: Uses GitHub CLI authentication when available
- 📦 **Interactive Installation**: Browse and install instructions with an interactive CLI interface
- 🗑️ **Easy Uninstallation**: Remove managed instructions with interactive selection
- 📋 **Updates**: Pull the latest versions of installed instructions from their source repositories

## Usage:

```bash
# Add repositories to pull instructions from (public or private)
npx instruction-hub config add https://github.com/owner/my-copilot-instructions
npx instruction-hub config add owner/repo
npx instruction-hub config add https://ghe.company.com/company-org/company-copilot-instructions

# Install instructions interactively
npx instruction-hub install
# (or add, or just i)

# List managed instructions
npx instruction-hub list

# Update managed instructions
npx instruction-hub update

# Uninstall instructions
npx instruction-hub uninstall
# (or remove, or rm)
```

## Authentication

### GitHub Enterprise & Private Repositories

For private repositories or GitHub Enterprise instances, you'll need to authenticate using the GitHub CLI:

```bash
# Install GitHub CLI (if not already installed)
brew install gh

# Authenticate with public GitHub
gh auth login

# Authenticate with GitHub Enterprise
gh auth login --hostname ghe.company.com

# Verify authentication
gh auth status
```

The tool automatically detects your authentication and uses the appropriate tokens for API requests.

### Supported Authentication Methods

- **GitHub CLI**: Automatically uses tokens from `gh auth` (recommended)
- **Public repositories**: No authentication required
- **Multiple instances**: Supports both public GitHub and enterprise instances simultaneously

## Configuration

Configuration is stored globally in `~/.instruction-hub/config.json` and includes:
- List of configured repositories

## Installation (Optional)

While the tool is designed to be used with `npx` or `bunx`, you can also install it globally if preferred:

```bash
npm install -g instruction-hub
# or
bun install -g instruction-hub
```

## License

MIT

## Contributing

Issues and pull requests are welcome!

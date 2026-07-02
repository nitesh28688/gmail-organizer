# PowerShell script to fix SSH folder and file permissions on Windows.
# OpenSSH requires strict permissions (only the current user and SYSTEM).

$sshDir = "$env:USERPROFILE\.ssh"

Write-Host "Resetting and securing permissions for: $sshDir"

# Ensure the .ssh directory exists
if (Test-Path $sshDir) {
    # 1. Reset directory permissions to inherit clean defaults
    icacls $sshDir /reset
    
    # 2. Disable inheritance and remove all inherited permissions (like UWP SIDs)
    icacls $sshDir /inheritance:r
    
    # 3. Grant Full Control to only the current user and SYSTEM
    icacls $sshDir /grant:r "$($env:USERNAME):(OI)(CI)(F)"
    icacls $sshDir /grant:r "SYSTEM:(OI)(CI)(F)"

    # Get all files inside the .ssh directory
    $files = Get-ChildItem -Path $sshDir -File

    foreach ($file in $files) {
        $filePath = $file.FullName
        Write-Host "Securing file: $filePath"
        
        # Reset file permissions first to inherit from the newly secured directory
        icacls $filePath /reset
        
        # Remove inheritance on the file
        icacls $filePath /inheritance:r
        
        # Grant access strictly to current user and SYSTEM
        icacls $filePath /grant:r "$($env:USERNAME):(F)"
        icacls $filePath /grant:r "SYSTEM:(F)"
    }
    
    Write-Host "SSH permissions successfully updated! Try pushing to git now."
} else {
    Write-Warning "SSH directory not found at $sshDir"
}

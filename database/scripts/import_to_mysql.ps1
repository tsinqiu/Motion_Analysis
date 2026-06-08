param(
    [string]$User = "root",
    [string]$HostName = "localhost",
    [int]$Port = 3306,
    [string]$Mysql = "mysql",
    [string]$Schema = "sql/01_schema.sql",
    [string]$Import = "sql/02_import_data.sql"
)

$ErrorActionPreference = "Stop"

function Resolve-SqlPath([string]$PathText) {
    return (Resolve-Path -LiteralPath $PathText).Path.Replace("\", "/")
}

$schemaPath = Resolve-SqlPath $Schema
$importPath = Resolve-SqlPath $Import

$securePassword = Read-Host "MySQL password for $User@$HostName" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

$defaultsFile = Join-Path $env:TEMP ("motion_analysis_mysql_{0}.cnf" -f ([Guid]::NewGuid().ToString("N")))

try {
    @"
[client]
user=$User
password=$plainPassword
host=$HostName
port=$Port
default-character-set=utf8mb4
"@ | Set-Content -LiteralPath $defaultsFile -Encoding ASCII

    Write-Host "Applying schema: $schemaPath"
    & $Mysql --defaults-extra-file="$defaultsFile" --execute="source $schemaPath"

    Write-Host "Importing data: $importPath"
    & $Mysql --defaults-extra-file="$defaultsFile" --execute="source $importPath"

    Write-Host "Verifying row counts..."
    & $Mysql --defaults-extra-file="$defaultsFile" --database=MotionAnalysis --table --execute="
SELECT 'Activities' AS table_name, COUNT(*) AS row_count FROM Activities
UNION ALL SELECT 'SourceFiles', COUNT(*) FROM SourceFiles
UNION ALL SELECT 'ActivitySourceFiles', COUNT(*) FROM ActivitySourceFiles
UNION ALL SELECT 'Sessions', COUNT(*) FROM Sessions
UNION ALL SELECT 'Laps', COUNT(*) FROM Laps
UNION ALL SELECT 'TrackPoints', COUNT(*) FROM TrackPoints
UNION ALL SELECT 'Events', COUNT(*) FROM Events
UNION ALL SELECT 'ActivitySummaries', COUNT(*) FROM ActivitySummaries
UNION ALL SELECT 'ActivityZones', COUNT(*) FROM ActivityZones;
"
}
finally {
    if (Test-Path -LiteralPath $defaultsFile) {
        Remove-Item -LiteralPath $defaultsFile -Force
    }
}

# Script PowerShell pour initialiser les tables unpaid_sessions_with_email
# Usage: .\init-unpaid-tables.ps1

Write-Host "🔧 Initialisation des tables unpaid_sessions..." -ForegroundColor Cyan

# Configuration
$SITE_URL = "https://sosdivorce.vercel.app"
$SETUP_ENDPOINT = "$SITE_URL/api/setup-db"

# Demander la clé SETUP_KEY
$SETUP_KEY = Read-Host "Entrez votre SETUP_KEY"

if ([string]::IsNullOrWhiteSpace($SETUP_KEY)) {
    Write-Host "❌ Erreur: SETUP_KEY requise" -ForegroundColor Red
    exit 1
}

Write-Host "`n📡 Envoi de la requête à $SETUP_ENDPOINT..." -ForegroundColor Yellow

try {
    # Créer les headers
    $headers = @{
        "X-Setup-Key" = $SETUP_KEY
    }

    # Faire la requête
    $response = Invoke-RestMethod -Uri $SETUP_ENDPOINT -Method Get -Headers $headers -ContentType "application/json"

    # Afficher le résultat
    Write-Host "`n✅ Succès!" -ForegroundColor Green
    Write-Host "`n📊 Résultat:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 5)

    if ($response.details.unpaidSessions) {
        Write-Host "`n✅ Table unpaid_sessions_with_email créée" -ForegroundColor Green
    }

    if ($response.details.unpaidMessages) {
        Write-Host "✅ Table unpaid_messages créée" -ForegroundColor Green
    }

    Write-Host "`n🎉 Initialisation terminée avec succès!" -ForegroundColor Green

} catch {
    Write-Host "`n❌ Erreur lors de la requête:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red

    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Code HTTP: $statusCode" -ForegroundColor Red
    }

    exit 1
}

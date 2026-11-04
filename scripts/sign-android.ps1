param(
  [Parameter(Mandatory=$true)][string]$UnsignedApk,
  [Parameter(Mandatory=$true)][string]$ApkSignerJar,
  [Parameter(Mandatory=$true)][string]$KeyStore,
  [Parameter(Mandatory=$true)][string]$PasswordFile,
  [Parameter(Mandatory=$true)][string]$OutputApk,
  [string]$Java = 'java'
)
$ErrorActionPreference = 'Stop'
foreach ($inputPath in @($UnsignedApk,$ApkSignerJar,$KeyStore,$PasswordFile)) {
  if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) { throw "Missing input: $inputPath" }
}
if (Test-Path -LiteralPath $OutputApk) { throw 'Choose a new output file to avoid replacing an installer.' }
& $Java -jar $ApkSignerJar sign --ks $KeyStore --ks-key-alias dailyscroll --ks-pass "file:$PasswordFile" --key-pass "file:$PasswordFile" --out $OutputApk $UnsignedApk
if ($LASTEXITCODE -ne 0) { throw 'APK signing failed' }
& $Java -jar $ApkSignerJar verify --verbose --print-certs $OutputApk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
$apkItem = Get-Item -LiteralPath $OutputApk
$apkHash = (Get-FileHash -LiteralPath $OutputApk -Algorithm SHA256).Hash.ToLower()
"$apkHash  $($apkItem.Name)" | Set-Content -Encoding ascii -LiteralPath (Join-Path $apkItem.DirectoryName 'ANDROID-SHA256.txt')

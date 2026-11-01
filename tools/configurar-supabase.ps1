# Guarda la credencial local. No cambia la contrasena del proyecto en Supabase.
# La entrada es oculta: nunca pasar la contrasena como argumento ni pegarla en el chat.
$ErrorActionPreference = 'Stop'
$projectDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$environmentFile = [System.IO.Path]::GetFullPath((Join-Path $projectDirectory '.env.local'))
$temporaryFile = [System.IO.Path]::GetFullPath((Join-Path $projectDirectory ('.env.local.' + [guid]::NewGuid().ToString('N') + '.tmp')))
foreach ($target in @($environmentFile, $temporaryFile)) {
    if (-not [string]::Equals([System.IO.Path]::GetDirectoryName($target), $projectDirectory, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Ruta de configuracion fuera del proyecto.'
    }
}
$firstSecret = $null
$secondSecret = $null
$firstPointer = [IntPtr]::Zero
$secondPointer = [IntPtr]::Zero
try {
    Write-Host 'Proyecto Supabase: dkhqkvbxnlklzaskfzsq'
    Write-Host 'Introduce la contrasena ACTUAL de PostgreSQL, no la de tu cuenta de Supabase.'
    Write-Host 'Se guardara en este archivo:'
    Write-Host $environmentFile
    $firstSecret = Read-Host 'Contrasena (entrada oculta)' -AsSecureString
    $secondSecret = Read-Host 'Repite la contrasena' -AsSecureString
    $firstPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($firstSecret)
    $secondPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secondSecret)
    $firstText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPointer)
    $secondText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPointer)
    if ([string]::IsNullOrEmpty($firstText) -or $firstText -cne $secondText) {
        throw 'Las contrasenas estan vacias o no coinciden. No se guardo ningun cambio.'
    }
    $encodedSecret = [Uri]::EscapeDataString($firstText)
    $connection = 'postgresql://postgres.dkhqkvbxnlklzaskfzsq:' + $encodedSecret + '@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full'
    $previous = ''
    if ([System.IO.File]::Exists($environmentFile)) {
        $previous = [System.IO.File]::ReadAllText($environmentFile)
    }
    $retained = [regex]::Replace($previous, '(?m)^[\t ]*DATABASE_URL[\t ]*=.*(?:\r?\n|$)', '').TrimEnd()
    $updated = $retained + "`r`n" + 'DATABASE_URL="' + $connection + '"' + "`r`n"
    [System.IO.File]::WriteAllText($temporaryFile, $updated, [System.Text.UTF8Encoding]::new($false))
    if ([System.IO.File]::Exists($environmentFile)) {
        [System.IO.File]::Replace($temporaryFile, $environmentFile, $null)
    } else {
        [System.IO.File]::Move($temporaryFile, $environmentFile)
    }
    if ([System.IO.File]::ReadAllText($environmentFile) -cne $updated) {
        throw 'No se pudo verificar el contenido guardado.'
    }
    Write-Host 'GUARDADO Y VERIFICADO. Los simbolos de la contrasena se codificaron automaticamente.' -ForegroundColor Green
    Write-Host 'Esto actualiza la conexion local; no cambia la contrasena remota ni aplica migraciones.'
    Write-Host 'Cierra cualquier vista antigua del archivo y vuelve a abrirlo para ver el cambio.'
} catch {
    # No imprimir excepciones externas: podrian incluir la cadena de conexion.
    Write-Host 'No se completo la configuracion. Comprueba que ambas entradas coincidan y que el archivo no este bloqueado.' -ForegroundColor Red
    Write-Host 'La contrasena no se muestra ni se envia a Supabase desde esta utilidad.'
    exit 1
} finally {
    if ($firstPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPointer) }
    if ($secondPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPointer) }
    if ($null -ne $firstSecret) { $firstSecret.Dispose() }
    if ($null -ne $secondSecret) { $secondSecret.Dispose() }
    $firstText = $null; $secondText = $null; $encodedSecret = $null
    $connection = $null; $previous = $null; $retained = $null; $updated = $null
    if ([System.IO.File]::Exists($temporaryFile)) { [System.IO.File]::Delete($temporaryFile) }
}

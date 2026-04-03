# ============================================================
# PermissionReport_SPO_MultiSite.ps1
# PowerShell 7.5.4 + PnP.PowerShell 3.x + Excel COM
#
# MULTI - SITE(tenant enumeration) -> per - site CSV + XLSX
#
# OUTPUT per site(separate folders):
#   CSV: <OutFolder>\CSV Files\<SiteName>_PermissionReport.csv
#   XLSX: <OutFolder>\Excel Files\<SiteName>_PermissionReport_Color.xlsx(4 sheets)
#       1) Permissions(REAL cell - fill colors + internal hyperlink to Sites - Groups)
#       2) Sites - Groups(has hidden DirectoryGroupId for hyperlink mapping)
#       3) Groups - Members(_GroupId hidden)
#       4) Groups - Summary(_GroupId hidden)
#
# Defaults: SKIP OneDrive, root / home, /search, appcatalog, archived
# ============================================================

    [CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$TenantUrl,

    [Parameter(Mandatory = $false)]
    [string]$OutFolder = "C:\Reports",

  # Entra App Registration values
[Parameter(Mandatory = $false)]
[string]$Tenant = "41f14ec6-31bd-4fe8-8fe4-28c33f689d3e",

    [Parameter(Mandatory = $false)]
    [string]$ClientId = "db90de13-e96e-4c16-93db-03d074e3563e",

    [Parameter(Mandatory = $false)]
    [string]$LoginHint = "",

  # Behavior
[Parameter(Mandatory = $false)]
[switch]$IncludeInheritedPermissions,

    [Parameter(Mandatory = $false)]
    [switch]$IncludeFolderPermissions,    # UNIQUE folder perms only(doc libs)

    [Parameter(Mandatory = $false)]
    [switch]$LibrariesOnly,               # ✅ Only document libraries(skip lists)

    [Parameter(Mandatory = $false)]
    [switch]$DisableDirectoryGroupExpansion,

        [Parameter(Mandatory = $false)]
        [switch]$DisableTransitiveMembers,

            [Parameter(Mandatory = $false)]
            [int]$MaxUsersPerDirectoryGrp = 20000,

  # Site filters(defaults: skip these)
[Parameter(Mandatory = $false)]
[switch]$IncludeRootSite,

    [Parameter(Mandatory = $false)]
    [switch]$IncludeSearchSite,

        [Parameter(Mandatory = $false)]
        [switch]$IncludeAppCatalogSite,

            [Parameter(Mandatory = $false)]
            [switch]$IncludeArchivedSites,

                [Parameter(Mandatory = $false)]
                [switch]$IncludeOneDriveSites
)

Set - StrictMode - Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------
# Normalize basic inputs
# ---------------------------
    $TenantUrl = ([string]$TenantUrl).Trim().Trim('"').Trim("'").Trim()
if ($TenantUrl - notmatch '^https?://') { throw "TenantUrl must be like: https://tenant.sharepoint.com" }

# Convert switches into booleans used later
$script: IncludeInheritedPermissions = $IncludeInheritedPermissions.IsPresent
$script: IncludeFolderPermissions = $IncludeFolderPermissions.IsPresent
$script: LibrariesOnly = $LibrariesOnly.IsPresent
$script: ExpandDirectoryGroups = -not $DisableDirectoryGroupExpansion.IsPresent
$script: UseTransitiveMembers = -not $DisableTransitiveMembers.IsPresent

# ----------------------------
# Exclusions(lists)
# ----------------------------
    $ExcludedLists = @(
        "Access Requests", "App Packages", "appdata", "appfiles", "Apps in Testing", "Cache Profiles", "Composed Looks",
        "Content and Structure Reports", "Content type publishing error log", "Converted Forms", "Device Channels",
        "Form Templates", "fpdatasources", "Get started with Apps for Office and SharePoint", "List Template Gallery",
        "Long Running Operation Status", "Maintenance Log Library", "Images", "site collection images", "Master Docs",
        "Master Page Gallery", "MicroFeed", "NintexFormXml", "Quick Deploy Items", "Relationships List", "Reusable Content",
        "Reporting Metadata", "Reporting Templates", "Search Config List", "Site Assets", "Preservation Hold Library",
        "Site Pages", "Solution Gallery", "Style Library", "Suggested Content Browser Locations", "Theme Gallery",
        "TaxonomyHiddenList", "User Information List", "Web Part Gallery", "wfpub", "wfsvc", "Workflow History",
        "Workflow Tasks", "Pages"
    )

$ExcludedSharePointGroups = @("Limited Access System Group", "SharingLinks.000", "SharingLinks")

# ============================================================
# STA Guard(Excel COM requires STA)
# ============================================================
if ($IsWindows - and[System.Threading.Thread]:: CurrentThread.ApartmentState - ne "STA") {
    if ($PSCommandPath) {
        Write - Host "Relaunching in STA for Excel COM..." - ForegroundColor Yellow
        $pwsh = Join - Path $PSHOME "pwsh.exe"

        $argList = @("-STA", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath)
        foreach($k in $PSBoundParameters.Keys) {
            $v = $PSBoundParameters[$k]
            if ($v - is[System.Management.Automation.SwitchParameter]) {
                if ($v.IsPresent) { $argList += "-$k" }
            } else {
                $argList += "-$k"
                $argList += "$v"
            }
        }

        Start - Process - FilePath $pwsh - ArgumentList $argList | Out - Null
        exit
    }
}

# ============================================================
# Module check
# ============================================================
if (-not(Get - Module - ListAvailable - Name "PnP.PowerShell")) {
    throw "PnP.PowerShell module not found. Install: Install-Module PnP.PowerShell -Scope CurrentUser"
}
Import - Module PnP.PowerShell - ErrorAction Stop

# ============================================================
# Helpers
# ============================================================
    function Ensure- Directory {
    param([Parameter(Mandatory = $true)][string]$DirPath)
    if (-not(Test - Path $DirPath)) { New - Item - ItemType Directory - Path $DirPath - Force | Out - Null }
}
function Ensure-ParentFolder {
    param([Parameter(Mandatory = $true)][string]$FilePath)
    $dir = Split - Path $FilePath - Parent
    Ensure - Directory - DirPath $dir
}
function Try-GetProp { param([object]$Obj, [string]$Name) try { return $Obj.$Name } catch { return "" } }

function Get-SafeSiteName {
    param([Parameter(Mandatory = $true)][string]$Url)
    $u = [Uri]$Url
    $segments = $u.AbsolutePath.Trim('/').Split('/')
    $idxSites = [Array]:: IndexOf($segments, "sites")
    $idxTeams = [Array]:: IndexOf($segments, "teams")
    $name = if ($idxSites - ge 0 - and $segments.Length - ge($idxSites + 2)) {
        $segments[$idxSites + 1]
    } elseif($idxTeams - ge 0 - and $segments.Length - ge($idxTeams + 2)) {
        $segments[$idxTeams + 1]
    } else {
        ($u.Host - replace '\W', '_')
    }
    return ($name - replace '[\\/:*?"<>| ]', '_')
}

function Get-SharePointSiteRootUrl {
    param([Parameter(Mandatory = $true)][string]$Url)
    $u = [Uri]$Url
    $segments = $u.AbsolutePath.Trim('/').Split('/')

    $idxSites = [Array]:: IndexOf($segments, "sites")
    if ($idxSites - ge 0 - and $segments.Length - ge($idxSites + 2)) {
        return "{0}://{1}/sites/{2}" - f $u.Scheme, $u.Host, $segments[$idxSites + 1]
    }
    $idxTeams = [Array]:: IndexOf($segments, "teams")
    if ($idxTeams - ge 0 - and $segments.Length - ge($idxTeams + 2)) {
        return "{0}://{1}/teams/{2}" - f $u.Scheme, $u.Host, $segments[$idxTeams + 1]
    }
    return "{0}://{1}" - f $u.Scheme, $u.Host
}

function Get-AbsoluteUrlFromServerRelative {
    param([Parameter(Mandatory = $true)][string]$ServerRelativeUrl)
    if (-not $script:Web) { return $ServerRelativeUrl }
    $base = $script: Web.Url.Replace($script: Web.ServerRelativeUrl, '')
    return ("{0}{1}" - f $base, $ServerRelativeUrl)
}

function Extract-GuidFromLoginName {
    param([string]$LoginName)
    if ([string]:: IsNullOrWhiteSpace($LoginName)) { return $null }
    $m = [regex]:: Match($LoginName, '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')
    if ($m.Success) { return $m.Groups[1].Value }
    return $null
}

function Get-TenantAdminUrl {
    param([Parameter(Mandatory = $true)][string]$TenantUrl)
    $u = [Uri]$TenantUrl
    $tenantHost = $u.Host   # ✅ DO NOT use $Host(read - only)
    if ($tenantHost - notmatch 'sharepoint\.com$') { throw "TenantUrl host must be *.sharepoint.com" }
    $prefix = $tenantHost.Split('.')[0]
    return "{0}://{1}-admin.sharepoint.com" - f $u.Scheme, $prefix
}

# ============================================================
# Auth
# ============================================================
    function Connect- PnPInteractive {
    param([Parameter(Mandatory = $true)][string]$Url)

    $Url = ([string]$Url).Trim()
    if ([string]:: IsNullOrWhiteSpace($Url)) { throw "Connect-PnPInteractive got empty Url." }

    $cmd = Get - Command Connect - PnPOnline - ErrorAction Stop
    if ($cmd.Parameters.ContainsKey("LoginHint") - and - not[string]:: IsNullOrWhiteSpace($LoginHint)) {
        Connect - PnPOnline - Url $Url - Interactive - Tenant $Tenant - ClientId $ClientId - LoginHint $LoginHint
    } else {
        Connect - PnPOnline - Url $Url - Interactive - Tenant $Tenant - ClientId $ClientId
    }
}

# ============================================================
# INTERNAL STATE(per site)
# ============================================================
    $script: CsvInitialized = $false
$script: Web = $null
$script: WebTitle = ""
$script: GraphToken = $null
$script: GraphTokenExpUtc = [datetime]:: MinValue
$script: GroupMetaCache = @{}
$script: GroupUsersCache = @{}
$script: DirectoryGroupsSeen = @{}

$script: ReportFile = $null
$script: ExcelReportFile = $null
$script: SiteURL = $null

function Reset-RunState {
    $script: CsvInitialized = $false
    $script: Web = $null
    $script: WebTitle = ""
    $script: GraphToken = $null
    $script: GraphTokenExpUtc = [datetime]:: MinValue
    $script: GroupMetaCache = @{}
    $script: GroupUsersCache = @{}
    $script: DirectoryGroupsSeen = @{}
}

# ============================================================
# CSV Writer
# ============================================================
    function Write- ReportRows {
    param([Parameter(Mandatory = $true)][object[]]$Rows)
    if ($null - eq $Rows - or @($Rows).Count -eq 0) { return }
    if (-not $script:CsvInitialized) {
        $Rows | Export - Csv - Path $script: ReportFile - NoTypeInformation
        $script: CsvInitialized = $true
    } else {
        $Rows | Export - Csv - Path $script: ReportFile - NoTypeInformation - Append
    }
}

# ============================================================
# Row Model
# ============================================================
    function New- PermissionRow {
    param(
        [string]$ObjectType, [string]$ObjectTitle, [string]$ObjectUrl, [bool]$HasUniquePermissions,
        [string]$RowKind,
        [string]$GroupName, [string]$GroupLoginName,
        [string]$Users, [string]$UserEmail,
        [string]$Type, [string]$Permissions, [string]$GrantedThrough,
        [string]$NestedGroupName, [string]$NestedGroupId, [string]$NestedGroupType, [string]$MembershipPath
    )
    [pscustomobject]@{
        Object               = $ObjectType
    Title                = $ObjectTitle
    URL                  = $ObjectUrl
    HasUniquePermissions = $HasUniquePermissions
    RowKind              = $RowKind
    GroupName            = $GroupName
    GroupLoginName       = $GroupLoginName
    Users                = $Users
    UserEmail            = $UserEmail
    Type                 = $Type
    Permissions          = $Permissions
    GrantedThrough       = $GrantedThrough
    NestedGroupName      = $NestedGroupName
    NestedGroupId        = $NestedGroupId
    NestedGroupType      = $NestedGroupType
    MembershipPath       = $MembershipPath
    }
}

# ============================================================
# Graph helpers
# ============================================================
    function Ensure- GraphTokenFromPnP {
    if (-not $script:ExpandDirectoryGroups) { return $false }

    $now = (Get - Date).ToUniversalTime()
    if ($script: GraphToken - and $script: GraphTokenExpUtc - gt $now.AddMinutes(1)) { return $true }

    try { $tok = Get - PnPAccessToken - ResourceType Graph }
    catch { return $false }

    $script: GraphToken = $tok

    try {
        $parts = $tok.Split('.')
        $payload = $parts[1].Replace('-', '+').Replace('_', '/')
        switch ($payload.Length % 4) { 2 { $payload += '==' } 3 { $payload += '=' }
    }
    $json = [Text.Encoding]:: UTF8.GetString([Convert]:: FromBase64String($payload))
    $obj = $json | ConvertFrom - Json
    if ($obj.exp) { $script: GraphTokenExpUtc = [DateTimeOffset]:: FromUnixTimeSeconds([int64]$obj.exp).UtcDateTime }
    else { $script: GraphTokenExpUtc = $now.AddMinutes(30) }
} catch {
    $script: GraphTokenExpUtc = $now.AddMinutes(30)
}

return $true
}

function Invoke-GraphGetAll {
    param([Parameter(Mandatory = $true)][string]$Url)

    if (-not(Ensure - GraphTokenFromPnP)) { return @() }

    $results = New - Object System.Collections.Generic.List[object]
    $next = $Url

    while ($next) {
        $resp = Invoke - RestMethod - Method Get - Uri $next - Headers @{ Authorization = "Bearer $($script:GraphToken)" }
        if ($resp - and $resp.value) { foreach($v in $resp.value) { $results.Add($v) } }

        $prop = $resp.PSObject.Properties['@odata.nextLink']
        if ($prop - and $prop.Value) { $next = $prop.Value } else { $next = $null }

        if ($results.Count - ge $MaxUsersPerDirectoryGrp) { break }
    }
    return $results.ToArray()
}

function Track-DirectoryGroupSeen {
    param([Parameter(Mandatory = $true)][string]$GroupId, [Parameter(Mandatory = $true)][string]$FoundVia)

    if ($GroupId - ieq $Tenant) { return } # ✅ prevent tenant - id noise
    if (-not $script: DirectoryGroupsSeen.ContainsKey($GroupId)) {
        $script: DirectoryGroupsSeen[$GroupId] = [pscustomobject]@{
            Id          = $GroupId
      DisplayName = ""
      Mail        = ""
      GroupType   = ""
      FoundVia    = (New - Object System.Collections.Generic.HashSet[string])
            FirstSeenOn = (Get - Date)
        }
    }
    $null = $script: DirectoryGroupsSeen[$GroupId].FoundVia.Add($FoundVia)
}

function Get-GraphGroupMeta {
    param([Parameter(Mandatory = $true)][string]$GroupId)

    if ($GroupId - ieq $Tenant) { return $null }
    if ($script: GroupMetaCache.ContainsKey($GroupId)) { return $script: GroupMetaCache[$GroupId] }
    if (-not(Ensure - GraphTokenFromPnP)) { return $null }

    $url = "https://graph.microsoft.com/v1.0/groups/$GroupId`?`$select=id,displayName,mailEnabled,securityEnabled,groupTypes,mail"
    try {
        $g = Invoke - RestMethod - Method Get - Uri $url - Headers @{ Authorization = "Bearer $($script:GraphToken)" }

        $gType = "Group"
        if ($g.groupTypes - and($g.groupTypes - contains "Unified")) { $gType = "Microsoft365Group" }
        elseif($g.securityEnabled - eq $true) { $gType = "SecurityGroup" }

        $meta = [pscustomobject]@{
            Id          = $g.id
      DisplayName = $g.displayName
      Mail        = $g.mail
      GroupType   = $gType
        }
        $script: GroupMetaCache[$GroupId] = $meta

        if ($script: DirectoryGroupsSeen.ContainsKey($GroupId)) {
            $script: DirectoryGroupsSeen[$GroupId].DisplayName = $meta.DisplayName
            $script: DirectoryGroupsSeen[$GroupId].Mail = $meta.Mail
            $script: DirectoryGroupsSeen[$GroupId].GroupType = $meta.GroupType
        }

        return $meta
    } catch {
        return $null
    }
}

function Get-GraphGroupUsers {
    param([Parameter(Mandatory = $true)][string]$GroupId)

    if ($GroupId - ieq $Tenant) { return @() }
    if ($script: GroupUsersCache.ContainsKey($GroupId)) { return $script: GroupUsersCache[$GroupId] }
    if (-not(Ensure - GraphTokenFromPnP)) { return @() }

    $select = "id,displayName,mail,userPrincipalName,userType,accountEnabled"
    $url = if ($script:UseTransitiveMembers) {
        "https://graph.microsoft.com/v1.0/groups/$GroupId/transitiveMembers/microsoft.graph.user`?`$select=$select"
    } else {
        "https://graph.microsoft.com/v1.0/groups/$GroupId/members/microsoft.graph.user`?`$select=$select"
    }

    $users = @()
    try { $users = Invoke - GraphGetAll - Url $url } catch { $users = @() }

    $norm = New - Object System.Collections.Generic.List[object]
    foreach($u in @($users)) {
        $uid = [string](Try - GetProp $u "id")
        if ([string]:: IsNullOrWhiteSpace($uid)) { continue }

        $upn = [string](Try - GetProp $u "userPrincipalName")
        $email = [string](Try - GetProp $u "mail")
        if ([string]:: IsNullOrWhiteSpace($email)) { $email = $upn }

        $alias = ""
        if ($upn - and $upn.Contains("@")) { $alias = $upn.Split("@")[0] }

        $norm.Add([pscustomobject]@{
            UserId          = $uid
      UserDisplayName =[string](Try - GetProp $u "displayName")
      UserUPN         = $upn
      UserEmail       = $email
      UserAlias       = $alias
      UserType        =[string](Try - GetProp $u "userType")
      AccountEnabled  = (Try - GetProp $u "accountEnabled")
    })
}

$script: GroupUsersCache[$GroupId] = $norm.ToArray()
return $script: GroupUsersCache[$GroupId]
}

# ============================================================
# Permissions Extraction
# ============================================================
    function Get- PnPPermissionsForObject {
    param([Parameter(Mandatory = $true)][Microsoft.SharePoint.Client.SecurableObject]$Object)

    $ObjectType = ""; $ObjectURL = ""; $ObjectTitle = ""

    switch ($Object.TypedObject.ToString()) {
    "Microsoft.SharePoint.Client.Web" {
        $ObjectType = "Site"
        $ObjectURL = $Object.Url
        $ObjectTitle = $Object.Title
    }
    "Microsoft.SharePoint.Client.List" {
        $ObjectType = "List or Library"
        $ObjectTitle = $Object.Title
        $RootFolder = Get - PnPProperty - ClientObject $Object - Property RootFolder
        $ObjectURL = Get - AbsoluteUrlFromServerRelative - ServerRelativeUrl $RootFolder.ServerRelativeUrl
    }
    "Microsoft.SharePoint.Client.ListItem" {
        $null = Get - PnPProperty - ClientObject $Object - Property FileSystemObjectType, FieldValues
        if ($Object.FileSystemObjectType.ToString() - eq "Folder") {
            $ObjectType = "Folder"
            $fileRef = ""
            try { $fileRef = [string]$Object.FieldValues["FileRef"] } catch { $fileRef = "" }
            if ([string]:: IsNullOrWhiteSpace($fileRef)) { return }
            $ObjectTitle = $fileRef
            $ObjectURL = Get - AbsoluteUrlFromServerRelative - ServerRelativeUrl $fileRef
        } else { return }
    }
    default { return }
}

$null = Get - PnPProperty - ClientObject $Object - Property HasUniqueRoleAssignments, RoleAssignments
$HasUniquePermissions = [bool]$Object.HasUniqueRoleAssignments

$rows = New - Object System.Collections.Generic.List[object]

foreach($ra in $Object.RoleAssignments) {
    $null = Get - PnPProperty - ClientObject $ra - Property RoleDefinitionBindings, Member

    $principalType = $ra.Member.PrincipalType.ToString()
    $perm = $ra.RoleDefinitionBindings | Select - Object - ExpandProperty Name
    $perm = ($perm | Where - Object { $_ - ne "Limited Access" }) -join ","
    if ([string]:: IsNullOrWhiteSpace($perm)) { continue }

    if ($principalType - eq "SharePointGroup") {
        $spGroupName = $ra.Member.Title
        $spGroupLoginName = $ra.Member.LoginName

        $rows.Add((New - PermissionRow`
        $ObjectType $ObjectTitle $ObjectURL $HasUniquePermissions `
        "GroupAssignment" `
        $spGroupName $spGroupLoginName `
        "" "" `
        "SharePointGroup" $perm "Direct (SharePoint Group)" `
        "" "" "" $spGroupName))

        if ($script: ExpandDirectoryGroups - and - not($ExcludedSharePointGroups - contains $spGroupName)) {
            $members = @()
            try { $members = Get - PnPGroupMember - Group $spGroupName } catch { $members = @() }

            foreach($m in @($members)) {
                $mLogin = [string](Try - GetProp $m "LoginName")
                $gid = Extract - GuidFromLoginName $mLogin
                if ($gid) {
                    Track - DirectoryGroupSeen - GroupId $gid - FoundVia("SPGroup: {0}" - f $spGroupName)
                    $meta = Get - GraphGroupMeta - GroupId $gid
                    if ($meta) {
                        $rows.Add((New - PermissionRow`
                $ObjectType $ObjectTitle $ObjectURL $HasUniquePermissions `
                "NestedDirectoryGroup" `
                $spGroupName $spGroupLoginName `
                "" "" `
                "DirectoryGroup" $perm ("SharePoint Group: {0}" -f $spGroupName) `
                $meta.DisplayName $meta.Id $meta.GroupType("{0} -> {1}" - f $spGroupName, $meta.DisplayName)))
                    }
                }
            }
        }
        continue
    }

    $pName = $ra.Member.Title
    $pEmail = ""; try { $pEmail = $ra.Member.Email } catch { }
    $pLogin = $ra.Member.LoginName
    $gid = Extract - GuidFromLoginName $pLogin

    if ($script: ExpandDirectoryGroups - and $gid) {
        Track - DirectoryGroupSeen - GroupId $gid - FoundVia "DirectAssignment"
        $meta = Get - GraphGroupMeta - GroupId $gid
        if ($meta) {
            $rows.Add((New - PermissionRow`
          $ObjectType $ObjectTitle $ObjectURL $HasUniquePermissions `
          "DirectDirectoryGroup" `
          "" "" `
          "" "" `
          $principalType $perm "Direct Directory Group" `
                ($meta.DisplayName)($meta.Id)($meta.GroupType)($meta.DisplayName)))
            continue
        }
    }

    $rows.Add((New - PermissionRow`
      $ObjectType $ObjectTitle $ObjectURL $HasUniquePermissions `
      "Direct" `
      "" "" `
      $pName $pEmail`
      $principalType $perm "Direct User/Principal" `
      "" "" "" $pName))
}

Write - ReportRows - Rows($rows.ToArray())
}

function Generate-PnPSitePermissionRpt {
    Ensure - ParentFolder $script: ReportFile
    $script: CsvInitialized = $false

    $root = Get - SharePointSiteRootUrl - Url $script: SiteURL
    Write - Host "Connecting: $root" - ForegroundColor Cyan
    Connect - PnPInteractive - Url $root

    $script: Web = Get - PnPWeb
    $script: WebTitle = $script: Web.Title

    if ($script:ExpandDirectoryGroups) { [void](Ensure - GraphTokenFromPnP) }

    Write - Host "Getting Site permissions: $($script:Web.Url)" - ForegroundColor Yellow
    Get - PnPPermissionsForObject - Object $script: Web

    Write - Host "Enumerating permissions for libraries/lists..." - ForegroundColor Yellow
    $lists = Get - PnPProperty - ClientObject $script: Web - Property Lists

    foreach($list in @($lists)) {
        if ($list.Hidden - eq $true) { continue }
        if ($ExcludedLists - contains $list.Title) { continue }

        $null = Get - PnPProperty - ClientObject $list - Property BaseType, Title

        if ($script:LibrariesOnly) {
            if ($list.BaseType.ToString() - ne "DocumentLibrary") { continue }
        }

        if ($script:IncludeInheritedPermissions) {
            Get - PnPPermissionsForObject - Object $list
        } else {
            $hu = Get - PnPProperty - ClientObject $list - Property HasUniqueRoleAssignments
            if ($hu - eq $true) { Get - PnPPermissionsForObject - Object $list }
        }
    }

    if ($script:IncludeFolderPermissions) {
        foreach($list in @($lists)) {
            if ($list.Hidden - eq $true) { continue }
            if ($ExcludedLists - contains $list.Title) { continue }

            $null = Get - PnPProperty - ClientObject $list - Property BaseType, Title
            if ($list.BaseType.ToString() - ne "DocumentLibrary") { continue }

            $items = @()
            try { $items = Get - PnPListItem - List $list - PageSize 2000 - Fields "FileRef", "FileLeafRef", "FSObjType" }
            catch { continue }

            foreach($it in @($items)) {
                $fs = $null
                try { $fs = $it.FieldValues["FSObjType"] } catch { $fs = $null }
                if ($fs - ne 1) { continue }

                $leaf = ""
                try { $leaf = [string]$it.FieldValues["FileLeafRef"] } catch { $leaf = "" }
                if ($leaf - eq "Forms") { continue }

                $huItem = $false
                try { $huItem = [bool](Get - PnPProperty - ClientObject $it - Property HasUniqueRoleAssignments) } catch { $huItem = $false }
                if (-not $huItem) { continue }

                try { Get - PnPPermissionsForObject - Object $it } catch { }
            }
        }
    }

    Write - Host "*** CSV generated: $($script:ReportFile) ***" - ForegroundColor Green
}

# ============================================================
# Groups sheets builders
# ============================================================
    function Build- GroupsMembersRows {
    if (-not $script:ExpandDirectoryGroups) { return @() }
    if ($script: DirectoryGroupsSeen.Count - eq 0) { return @() }

    $out = New - Object System.Collections.Generic.List[object]

    foreach($kv in $script: DirectoryGroupsSeen.GetEnumerator()) {
        $gid = [string]$kv.Key
        $seen = $kv.Value

        $meta = Get - GraphGroupMeta - GroupId $gid
        if (-not $meta) { continue }

        $foundVia = ""
        try { $foundVia = ($seen.FoundVia.ToArray() | Sort - Object) - join "; " } catch { $foundVia = "" }

        $users = @(Get - GraphGroupUsers - GroupId $gid)

        if (@($users).Count - eq 0) {
            $out.Add([pscustomobject]@{
                GroupDisplayName  = $meta.DisplayName
        GroupType         = $meta.GroupType
        GroupMail         = $meta.Mail
        FoundVia          = $foundVia
        UserDisplayName   = ""
        UserPrincipalName = ""
        UserEmail         = ""
        UserAlias         = ""
        UserType          = ""
        UserAccountEnabled= ""
        _GroupId          = $meta.Id
            })
            continue
        }

        foreach($u in $users) {
            $out.Add([pscustomobject]@{
                GroupDisplayName  = $meta.DisplayName
        GroupType         = $meta.GroupType
        GroupMail         = $meta.Mail
        FoundVia          = $foundVia
        UserDisplayName   = $u.UserDisplayName
        UserPrincipalName = $u.UserUPN
        UserEmail         = $u.UserEmail
        UserAlias         = $u.UserAlias
        UserType          = $u.UserType
        UserAccountEnabled= $u.AccountEnabled
        _GroupId          = $meta.Id
            })
        }
    }

    return $out.ToArray()
}

function Build-GroupsSummaryRows {
    param([object[]]$GroupsMembersRows)

    $GroupsMembersRows = @($GroupsMembersRows)
    if ($GroupsMembersRows.Count - eq 0) { return @() }

    $out = New - Object System.Collections.Generic.List[object]
    $grouped = $GroupsMembersRows | Group - Object _GroupId

    foreach($g in $grouped) {
        $rows = @($g.Group)
        $first = $rows | Select - Object - First 1
        $userCount = (@($rows | Where - Object { -not[string]:: IsNullOrWhiteSpace($_.UserPrincipalName) })).Count

        $out.Add([pscustomobject]@{
            GroupDisplayName = $first.GroupDisplayName
      GroupType        = $first.GroupType
      GroupMail        = $first.GroupMail
      FoundVia         = $first.FoundVia
      UserCount        = $userCount
      _GroupId         = $first._GroupId
        })
    }

    return ($out.ToArray() | Sort - Object - Property`
    @{ Expression = 'UserCount'; Descending = $true }, `
    @{ Expression = 'GroupDisplayName'; Descending = $false })
}

# ✅ UPDATED: adds DirectoryGroupId so Permissions sheet can jump to Sites - Groups accurately
function Build-SitesGroupsRows {
    param([object[]]$PermissionRows, [string]$SiteUrl, [string]$SiteTitle)

    $PermissionRows = @($PermissionRows)
    $out = New - Object System.Collections.Generic.List[object]

    foreach($r in $PermissionRows) {
        $scope = [string]$r.Object
        $library = ""
        $folder = ""
        if ($scope - eq "List or Library") { $library = [string]$r.Title }
        elseif($scope - eq "Folder")      { $folder = [string]$r.Title }

        $principalName = ""
        $principalType = ""
        $dirGroupId = ""

        if ([string]$r.RowKind - eq "GroupAssignment") {
            $principalName = [string]$r.GroupName
            $principalType = "SharePointGroup"
        }
        elseif([string]$r.RowKind - eq "NestedDirectoryGroup" - or[string]$r.RowKind - eq "DirectDirectoryGroup") {
            $principalName = [string]$r.NestedGroupName
            $principalType = [string]$r.NestedGroupType
            $dirGroupId = [string]$r.NestedGroupId
        }
    else {
            $principalName = [string]$r.Users
            $principalType = [string]$r.Type
        }

        $out.Add([pscustomobject]@{
            SiteTitle            = $SiteTitle
      SiteUrl              = $SiteUrl
      Scope                = $scope
      LibraryOrList        = $library
      FolderPath           = $folder
      ObjectUrl            =[string]$r.URL
      HasUniquePermissions =[string]$r.HasUniquePermissions
      PrincipalName        = $principalName
      PrincipalType        = $principalType
      Permissions          =[string]$r.Permissions
      GrantedThrough       =[string]$r.GrantedThrough
      MembershipPath       =[string]$r.MembershipPath
      DirectoryGroupId     = $dirGroupId   # <-- - used for hyperlink mapping(will be hidden)
    })
}

return $out.ToArray()
}

# ============================================================
# Excel COM helpers
# ============================================================
    function ExcelRGB([int]$r, [int]$g, [int]$b) { return ($r + $g * 256 + $b * 65536) }
function Get-ExcelColumnName([int]$n){
    $name = ""
    while ($n - gt 0) { $n--; $name = ([char](65 + ($n % 26))) + $name; $n = [math]:: Floor($n / 26) }
    $name
}

function Convert-CsvToExcel_FourSheets_Com {
    param(
        [Parameter(Mandatory = $true)][string]$CsvPath,
        [Parameter(Mandatory = $true)][string]$XlsxPath,
        [Parameter(Mandatory = $true)][string]$SiteUrl,
        [Parameter(Mandatory = $true)][string]$SiteTitle,
        [object[]]$GroupsMembersRows,
        [object[]]$GroupsSummaryRows
    )

    $GroupsMembersRows = @($GroupsMembersRows)
    $GroupsSummaryRows = @($GroupsSummaryRows)

    if (-not $IsWindows) { throw "Excel COM requires Windows." }
    if ([System.Threading.Thread]:: CurrentThread.ApartmentState - ne "STA") { throw "Run in STA: pwsh -STA -File <script.ps1>" }
    if (-not(Test - Path $CsvPath)) { throw "CSV not found: $CsvPath" }
    Ensure - ParentFolder $XlsxPath

    if (Test - Path $XlsxPath) {
        try {
            $fs = [System.IO.File]:: Open($XlsxPath, 'Open', 'ReadWrite', 'None'); $fs.Close()
            Remove - Item $XlsxPath - Force
        } catch {
            $stamp = Get - Date - Format "yyyyMMdd_HHmmss"
            $XlsxPath = $XlsxPath - replace '\.xlsx$', "_$stamp.xlsx"
        }
    }

    $main = Import - Csv $CsvPath
    if (-not $main - or @($main).Count -eq 0) { throw "CSV empty: $CsvPath" }

    $main = @($main)

  # column map
    $mainHeaders = $main[0].PSObject.Properties.Name
    $mainColMap = @{}
    for ($i = 0; $i - lt $mainHeaders.Count; $i++) { $mainColMap[$mainHeaders[$i]] = $i + 1 }

    $sitesGroupsRows = Build - SitesGroupsRows - PermissionRows $main - SiteUrl $SiteUrl - SiteTitle $SiteTitle
    $sitesGroupsRows = @($sitesGroupsRows)

  # ✅ Build mapping: DirectoryGroupId -> first row in "Sites - Groups"
  # ✅ Build mapping: DirectoryGroupId(NestedGroupId) -> first row in "Groups - Members"
# Uses _GroupId column in GroupsMembersRows
    $groupMembersFirstRow = @{}
    for ($r = 0; $r - lt $GroupsMembersRows.Count; $r++) {
        $excelRow = $r + 2
        $gid = ""
        try { $gid = [string]$GroupsMembersRows[$r]._GroupId } catch { $gid = "" }

        if (-not[string]:: IsNullOrWhiteSpace($gid) - and - not $groupMembersFirstRow.ContainsKey($gid)) {
            $groupMembersFirstRow[$gid] = $excelRow   # first occurrence only
        }
    }


  # ✅ REAL cell fill colors(no conditional formatting)
    $Color_RowKind = @{
        "Direct"               = 35
    "GroupAssignment"      = 15
    "NestedDirectoryGroup" = 39
    "DirectDirectoryGroup" = 38
    }
    $Color_FullControl = 3
    $Color_Edit = 45
    $Color_Read = 36

    $excel = $null; $wb = $null
    try {
        $excel = New - Object - ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false

        $wb = $excel.Workbooks.Add()

    # ensure exactly 4 sheets without Move() calls(robust)
        while ($wb.Worksheets.Count - lt 4) { $null = $wb.Worksheets.Add() }
        while ($wb.Worksheets.Count - gt 4) { $wb.Worksheets.Item($wb.Worksheets.Count).Delete() }

# ------------------------------------------------------------
# ✅ OLD - REPORT style: header palette + ColorIndex fills
# ------------------------------------------------------------
            $headerPalette = @(36, 34, 37, 35, 33, 15, 40, 24, 38, 39, 19, 22, 20, 18)

        function Apply-HeaderPalette {
            param([Parameter(Mandatory = $true)]$ws)

            $used = $ws.UsedRange
            $lastCol = $used.Columns.Count
            if ($lastCol - lt 1) { return }

            for ($c = 1; $c - le $lastCol; $c++) {
                $ws.Cells.Item(1, $c).Interior.ColorIndex = $headerPalette[($c - 1) % $headerPalette.Count]
                $ws.Cells.Item(1, $c).Font.Bold = $true
            }
        }

        function Find-ColIndexByHeader {
            param([Parameter(Mandatory = $true)]$ws, [Parameter(Mandatory = $true)][string]$HeaderName)

            $used = $ws.UsedRange
            $lastCol = $used.Columns.Count
            for ($c = 1; $c - le $lastCol; $c++) {
                $h = [string]$ws.Cells.Item(1, $c).Text
                if ($h - and $h.Trim().ToLower() - eq $HeaderName.Trim().ToLower()) { return $c }
            }
            return $null
        }

        function Apply-GroupTypeColorIndex {
            param([Parameter(Mandatory = $true)]$ws)

            $used = $ws.UsedRange
            $lastRow = $used.Rows.Count
            if ($lastRow - lt 2) { return }

            $colGT = Find - ColIndexByHeader - ws $ws - HeaderName "GroupType"
            if (-not $colGT) { return }

  # ✅ Old - style ColorIndex mapping(matches your screenshot vibe)
            $Color_SecurityGroup = 39
            $Color_Microsoft365Group = 35
            $Color_GenericGroup = 15

            for ($r = 2; $r - le $lastRow; $r++) {
                $gt = [string]$ws.Cells.Item($r, $colGT).Text
                if ($gt - eq "SecurityGroup") { $ws.Cells.Item($r, $colGT).Interior.ColorIndex = $Color_SecurityGroup }
                elseif($gt - eq "Microsoft365Group") { $ws.Cells.Item($r, $colGT).Interior.ColorIndex = $Color_Microsoft365Group }
                elseif(-not[string]:: IsNullOrWhiteSpace($gt)) { $ws.Cells.Item($r, $colGT).Interior.ColorIndex = $Color_GenericGroup }
            }
        }




        $ws1 = $wb.Worksheets.Item(1); $ws1.Name = "Permissions"
        $ws2 = $wb.Worksheets.Item(2); $ws2.Name = "Sites - Groups"
        $ws3 = $wb.Worksheets.Item(3); $ws3.Name = "Groups - Members"
        $ws4 = $wb.Worksheets.Item(4); $ws4.Name = "Groups - Summary"

        function Write-TableToSheet($ws, [object[]]$rows) {
            $rows = @($rows)
            if ($rows.Count - eq 0) { $ws.Cells.Item(1, 1).Value2 = "No rows available."; return }
            $headers = $rows[0].PSObject.Properties.Name
            $rCount = $rows.Count
            $cCount = $headers.Count

            $hdr = New - Object 'object[,]' 1, $cCount
            for ($c = 0; $c - lt $cCount; $c++) { $hdr[0, $c] = $headers[$c] }
            $ws.Range($ws.Cells.Item(1, 1), $ws.Cells.Item(1, $cCount)).Value2 = $hdr
            $ws.Rows.Item(1).Font.Bold = $true

            $vals = New - Object 'object[,]' $rCount, $cCount
            for ($r = 0; $r - lt $rCount; $r++) {
                for ($c = 0; $c - lt $cCount; $c++) {
                    $h = $headers[$c]
                    try { $vals[$r, $c] = $rows[$r].$h } catch { $vals[$r, $c] = "" }
                }
            }
            $ws.Range($ws.Cells.Item(2, 1), $ws.Cells.Item($rCount + 1, $cCount)).Value2 = $vals
            $ws.Rows.Item(1).AutoFilter() | Out - Null
            try { $ws.Columns.AutoFit() | Out - Null } catch { }
        }

    # Sheet 1: Permissions
        Write - TableToSheet - ws $ws1 - rows $main
# ✅ Permissions: colored header palette(old report)
        Apply - HeaderPalette - ws $ws1
    # Hide NestedGroupId column if exists(keep data for mapping)
            if ($mainColMap.ContainsKey("NestedGroupId")) { $ws1.Columns.Item($mainColMap["NestedGroupId"]).Hidden = $true }

        $ixRowKind = if ($mainColMap.ContainsKey("RowKind")) { $mainColMap["RowKind"] } else { $null }
        $ixPerms = if ($mainColMap.ContainsKey("Permissions")) { $mainColMap["Permissions"] } else { $null }
        $ixNestName = if ($mainColMap.ContainsKey("NestedGroupName")) { $mainColMap["NestedGroupName"] } else { $null }
        $ixNestId = if ($mainColMap.ContainsKey("NestedGroupId")) { $mainColMap["NestedGroupId"] } else { $null }

    # ✅ Apply REAL fill colors + hyperlink(NestedGroupName -> Sites - Groups)
        for ($r = 0; $r - lt $main.Count; $r++) {
            $excelRow = $r + 2

            $rk = ""
            try { $rk = [string]$main[$r].RowKind } catch { $rk = "" }

            if ($ixRowKind - and $Color_RowKind.ContainsKey($rk)) {
                $ws1.Cells.Item($excelRow, $ixRowKind).Interior.ColorIndex = $Color_RowKind[$rk]
            }

            if ($ixPerms) {
                $p = ""
                try { $p = [string]$main[$r].Permissions } catch { $p = "" }
                if ($p - match "Full Control") { $ws1.Cells.Item($excelRow, $ixPerms).Interior.ColorIndex = $Color_FullControl }
                elseif($p - match "Edit" - or $p - match "Contribute") { $ws1.Cells.Item($excelRow, $ixPerms).Interior.ColorIndex = $Color_Edit }
                elseif($p - match "Read" - or $p - match "View") { $ws1.Cells.Item($excelRow, $ixPerms).Interior.ColorIndex = $Color_Read }
            }

# ✅ Hyperlink fix: NestedGroupName -> Groups - Members sheet(Place in this document)
            if ($ixNestName - and $ixNestId - and($rk - eq "NestedDirectoryGroup" - or $rk - eq "DirectDirectoryGroup")) {
                $gid = ""
                $gname = ""
                try { $gid = [string]$main[$r].NestedGroupId } catch { $gid = "" }
                try { $gname = [string]$main[$r].NestedGroupName } catch { $gname = "" }

                if (-not[string]:: IsNullOrWhiteSpace($gid) - and $groupMembersFirstRow.ContainsKey($gid)) {
                    $targetRow = $groupMembersFirstRow[$gid]

    # "Place in this document"
                    $subAddr = "'Groups - Members'!A$targetRow"
                    $anchor = $ws1.Cells.Item($excelRow, $ixNestName)

                    try { if ($anchor.Hyperlinks.Count - gt 0) { $anchor.Hyperlinks.Delete() } } catch { }
                    try { $null = $ws1.Hyperlinks.Add($anchor, "", $subAddr, "Jump to Groups - Members", $gname) } catch { }
                }
            }

        }

    # Sheet 2: Sites - Groups
        Write - TableToSheet - ws $ws2 - rows $sitesGroupsRows
# ✅ Sites - Groups: colored header palette + GroupType colors(old report)
        Apply - HeaderPalette - ws $ws2
        Apply - GroupTypeColorIndex - ws $ws2

    # Hide DirectoryGroupId(used only for hyperlink mapping)
            try {
                $used2 = $ws2.UsedRange
                $lastCol2 = $used2.Columns.Count
                for ($c = 1; $c - le $lastCol2; $c++) {
                    $h = [string]$ws2.Cells(1, $c).Text
                    if ($h - and $h.Trim() - eq "DirectoryGroupId") { $ws2.Columns.Item($c).Hidden = $true }
                }
            } catch { }

    # Sheet 3: Groups - Members
        Write - TableToSheet - ws $ws3 - rows $GroupsMembersRows
# ✅ Groups - Members: colored header palette + GroupType colors(old report)
        Apply - HeaderPalette - ws $ws3
        Apply - GroupTypeColorIndex - ws $ws3

    # ------------------------------------------------------------
# ✅ Groups - Members: header colors + GroupType color fill(ColorIndex)
#    This makes "Filter by Color" behave like the old report.
# ------------------------------------------------------------
try {
            $headerPalette = @(36, 34, 37, 35, 33, 15, 40, 24, 38, 39, 19, 22, 20, 18)

            $used3 = $ws3.UsedRange
            $lastRow3 = $used3.Rows.Count
            $lastCol3 = $used3.Columns.Count

  # Header row palette(same as old)
            for ($c = 1; $c - le $lastCol3; $c++) {
                $ws3.Cells.Item(1, $c).Interior.ColorIndex = $headerPalette[($c - 1) % $headerPalette.Count]
                $ws3.Cells.Item(1, $c).Font.Bold = $true
            }

  # Find GroupType column index
            $colGroupType = $null
            for ($c = 1; $c - le $lastCol3; $c++) {
                $h = [string]$ws3.Cells.Item(1, $c).Text
                if ($h - and $h.Trim().ToLower() - eq "grouptype") { $colGroupType = $c; break }
            }

  # ColorIndex mapping(same as old)
            $Color_SecurityGroup = 39
            $Color_Microsoft365Group = 35
            $Color_GenericGroup = 15

            if ($colGroupType - and $lastRow3 - ge 2) {
                for ($r = 2; $r - le $lastRow3; $r++) {
                    $gt = [string]$ws3.Cells.Item($r, $colGroupType).Text
                    if ($gt - eq "SecurityGroup") { $ws3.Cells.Item($r, $colGroupType).Interior.ColorIndex = $Color_SecurityGroup }
                    elseif($gt - eq "Microsoft365Group"){ $ws3.Cells.Item($r, $colGroupType).Interior.ColorIndex = $Color_Microsoft365Group }
                    elseif(-not[string]:: IsNullOrWhiteSpace($gt)) { $ws3.Cells.Item($r, $colGroupType).Interior.ColorIndex = $Color_GenericGroup }
                }
            }

  # Hide _GroupId column(keep your existing hide logic OR use this)
            for ($c = 1; $c - le $lastCol3; $c++) {
                $h = [string]$ws3.Cells(1, $c).Text
                if ($h - and $h.Trim() - eq "_GroupId") { $ws3.Columns.Item($c).Hidden = $true }
            }
        } catch { }


        $wb.SaveAs($XlsxPath, 51) # xlOpenXMLWorkbook
        Write - Host "XLSX generated: $XlsxPath" - ForegroundColor Green
    }
    finally {
        if ($wb) { $wb.Close($false) | Out - Null }
        if ($excel) { $excel.Quit() | Out - Null }
        if ($wb) { [Runtime.InteropServices.Marshal]:: ReleaseComObject($wb) | Out - Null }
        if ($excel) { [Runtime.InteropServices.Marshal]:: ReleaseComObject($excel) | Out - Null }
        [GC]:: Collect();[GC]:: WaitForPendingFinalizers()
    }
}

# ============================================================
# Site enumeration + filters
# ============================================================
    function Should- SkipSite {
    param([string]$SiteUrl, [string]$TenantUrl)

    if ([string]:: IsNullOrWhiteSpace($SiteUrl)) { return $true }
    $u = $SiteUrl.Trim()

  # OneDrive
    if (-not $IncludeOneDriveSites.IsPresent) {
        if ($u - match 'https://.*-my\.sharepoint\.com/' - or $u - match '/personal/') { return $true }
    }

  # Root / home
    if (-not $IncludeRootSite.IsPresent) {
        if ($u.TrimEnd('/') - ieq $TenantUrl.TrimEnd('/')) { return $true }
    }

  # Search site
    if (-not $IncludeSearchSite.IsPresent) {
        if ($u - match '/search$' - or $u - match '/search/') { return $true }
    }

  # App catalog
    if (-not $IncludeAppCatalogSite.IsPresent) {
        if ($u - match '/sites/appcatalog$' - or $u - match '/sites/appcatalog/' ) { return $true }
    }

  # Archived
    if (-not $IncludeArchivedSites.IsPresent) {
        if ($u - match '/sites/archive' - or $u - match 'archive-' ) { return $true }
    }

    return $false
}

# ============================================================
# MAIN
# ============================================================
    Ensure - Directory - DirPath $OutFolder

# ✅ separate folders
$csvFolder = Join - Path $OutFolder "CSV Files"
$xlsxFolder = Join - Path $OutFolder "Excel Files"
Ensure - Directory - DirPath $csvFolder
Ensure - Directory - DirPath $xlsxFolder

Write - Host "TenantUrl: $TenantUrl" - ForegroundColor Cyan
Write - Host "OutFolder: $OutFolder" - ForegroundColor Cyan
Write - Host "CSV Folder : $csvFolder" - ForegroundColor Cyan
Write - Host "Excel Folder: $xlsxFolder" - ForegroundColor Cyan
Write - Host "Enumerating sites from tenant..." - ForegroundColor Yellow

$adminUrl = Get - TenantAdminUrl - TenantUrl $TenantUrl
Write - Host "Admin URL: $adminUrl" - ForegroundColor Cyan
Connect - PnPInteractive - Url $adminUrl

# Get all sites
$tenantSites = Get - PnPTenantSite - Detailed - IncludeOneDriveSites: $IncludeOneDriveSites.IsPresent

# Filter sites
$siteUrls = New - Object System.Collections.Generic.List[string]
foreach($s in @($tenantSites)) {
    $url = [string](Try - GetProp $s "Url")
    if (-not(Should - SkipSite - SiteUrl $url - TenantUrl $TenantUrl)) {
        $siteUrls.Add($url.Trim())
    }
}
Write - Host("Sites to process: {0}" - f $siteUrls.Count) - ForegroundColor Green

# Summary rows
$summary = New - Object System.Collections.Generic.List[object]

foreach($site in $siteUrls) {
    Reset - RunState
    $site = ([string]$site).Trim()

    try {
        $siteTag = Get - SafeSiteName - Url $site
        $script: SiteURL = $site

    # ✅ separate outputs
        $script: ReportFile = Join - Path $csvFolder("{0}_PermissionReport.csv" - f $siteTag)
        $script: ExcelReportFile = Join - Path $xlsxFolder("{0}_PermissionReport_Color.xlsx" - f $siteTag)

        Ensure - ParentFolder $script: ReportFile
        Ensure - ParentFolder $script: ExcelReportFile

        Write - Host "`n============================================================" - ForegroundColor DarkCyan
        Write - Host "Site: $site" - ForegroundColor DarkCyan
        Write - Host "CSV : $($script:ReportFile)" - ForegroundColor DarkCyan
        Write - Host "XLSX: $($script:ExcelReportFile)" - ForegroundColor DarkCyan
        Write - Host "LibrariesOnly              : $($script:LibrariesOnly)" - ForegroundColor DarkCyan
        Write - Host "IncludeInheritedPermissions: $($script:IncludeInheritedPermissions)" - ForegroundColor DarkCyan
        Write - Host "IncludeFolderPermissions   : $($script:IncludeFolderPermissions)" - ForegroundColor DarkCyan
        Write - Host "ExpandDirectoryGroups      : $($script:ExpandDirectoryGroups)" - ForegroundColor DarkCyan
        Write - Host "UseTransitiveMembers       : $($script:UseTransitiveMembers)" - ForegroundColor DarkCyan
        Write - Host "============================================================" - ForegroundColor DarkCyan

        Generate - PnPSitePermissionRpt

        $groupMemberRows = @(Build - GroupsMembersRows)
        $groupSummaryRows = @(Build - GroupsSummaryRows - GroupsMembersRows $groupMemberRows)

        Convert - CsvToExcel_FourSheets_Com`
      -CsvPath $script:ReportFile `
            - XlsxPath $script: ExcelReportFile`
      -SiteUrl $site `
                - SiteTitle $script: WebTitle`
      -GroupsMembersRows $groupMemberRows `
                    - GroupsSummaryRows $groupSummaryRows

        $summary.Add([pscustomobject]@{ Site=$site; Status="OK"; Csv=$script: ReportFile; Xlsx=$script: ExcelReportFile; Error="" })
    }
    catch {
        $msg = $_.Exception.Message
        Write - Host "FAILED: $site" - ForegroundColor Red
        Write - Host $msg - ForegroundColor Red
        $summary.Add([pscustomobject]@{ Site=$site; Status="FAILED"; Csv=$script: ReportFile; Xlsx=""; Error=$msg })
    }
}

# Write summary CSV
$stamp = Get - Date - Format "yyyyMMdd_HHmmss"
$summaryCsv = Join - Path $OutFolder("Tenant_Summary_{0}.csv" - f $stamp)
$summary | Export - Csv - NoTypeInformation - Path $summaryCsv
Write - Host "`nSummary CSV: $summaryCsv" - ForegroundColor Green
Write - Host "`nAll done." - ForegroundColor Green

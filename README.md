# **Emp Birthday Web Part**

## **Summary**

The **Employee Birthday Web Part** is a modern, visually appealing SharePoint Framework (SPFx) solution that displays upcoming employee birthdays in a horizontally scrollable card layout.
Each card includes profile photo, job title, formatted birthday (e.g., **December 01**), and visual indicators such as **Today** and **Tomorrow** labels.

The web part provides rich personalization options, including custom card backgrounds and configurable day range lookahead.

![Preview](./assets/preview-screenshot.png)

![Scrolling Demo](./assets/scrolling-mockup.png)

---

## **Used SharePoint Framework Version**

![version](https://img.shields.io/badge/version-1.21.1-green.svg)

---

## **Applies to**

* [SharePoint Framework](https://aka.ms/spfx)
* [Microsoft 365 tenant](https://docs.microsoft.com/en-us/sharepoint/dev/spfx/set-up-your-developer-tenant)

> Get your own free development tenant by subscribing to
> [Microsoft 365 developer program](http://aka.ms/o365devprogram)

---

## **Prerequisites**

* A SharePoint list named **EmployeeBirthdays** (default)

* Columns required:

  * `Title` (Single line of text)
  * `Birthday` (Date only)
  * `Email` (Single line of text)
  * `JobTitle` (Optional – Single line of text)

* API permission for:

  * **Microsoft Graph › Users.Read**
  * **Microsoft Graph › User.ReadBasic.All**
  * Used to fetch user profile photos

---

## **Solution**

| Solution             | Author(s)                               |
| -------------------- | --------------------------------------- |
| emp-birthday-webpart | Jitendra Sharma, Lead Software Engineer |

---

## **Version history**

| Version | Date     | Comments                                  |
| ------- | -------- | ----------------------------------------- |
| 1.1     | Nov 2025 | Birthday enhancements and UI improvements |
| 1.0     | Initial  | Initial release                           |

---

## **Disclaimer**

**THIS CODE IS PROVIDED *AS IS* WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE, MERCHANTABILITY, OR NON-INFRINGEMENT.**

---

## **Minimal Path to Awesome**

1. Clone this repository
2. Open the solution folder
3. Run:

```
npm install
gulp serve
```

---

# **Features**

This web part includes the following key features:

### **1. Horizontal Birthday Cards**

* Modern layout using a left-to-right scrolling row
* Cards maintain perfect alignment in all resolutions

### **2. Custom Background Image Selection**

* Multiple background templates included
* Selection through property pane
* Preview thumbnails shown

### **3. Smart Date Formatting**

* Birthday displayed as: **December 01**, **December 02**, etc.
* Special labels:

  * **Today**
  * **Tomorrow**

### **4. Age Calculation**

* Shows upcoming age (e.g., **Turning 35 today!**) — backend-ready

### **5. Sorting & Deduplication**

* Removes duplicate user entries
* Sorts by upcoming birthday order
* Old birthdays automatically roll over to next year

### **6. Microsoft Graph Photo Retrieval**

* Automatically fetches profile photos
* Fallback placeholder if not found

### **7. Footer Icons**

* Email icon opens a new mail window
* Cake icon represents celebration
* Icons aligned consistently at bottom of card

### **8. Default List Name**

* Automatically uses **EmployeeBirthdays** if user does not specify a list

### **9. Configurable Lookahead Range**

* Select number of upcoming days (default: **15 days**)
* Display only birthdays within the timeframe

### **10. Responsive & Mobile Friendly**

* Smooth horizontal scrolling
* Cards adjust to mobile layout without breaking

---

## **References**

* [Getting started with SharePoint Framework](https://docs.microsoft.com/en-us/sharepoint/dev/spfx/set-up-your-developer-tenant)
* [Building for Microsoft Teams](https://docs.microsoft.com/en-us/sharepoint/dev/spfx/build-for-teams-overview)
* [Using Microsoft Graph APIs](https://docs.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/get-started/using-microsoft-graph-apis)
* [Marketplace Publishing](https://docs.microsoft.com/en-us/sharepoint/dev/spfx/publish-to-marketplace-overview)
* [Microsoft 365 PnP](https://aka.ms/m365pnp)

---
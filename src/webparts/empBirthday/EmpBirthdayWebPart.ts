import { Version } from "@microsoft/sp-core-library";

import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneSlider,
  PropertyPaneChoiceGroup,
  PropertyPaneCheckbox
} from "@microsoft/sp-property-pane";

import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";

import * as React from "react";
import * as ReactDom from "react-dom";

import EmpBirthday from "./components/EmpBirthday";
import { IEmpBirthdayWebPartProps } from "./IEmpBirthdayWebPartProps";

import { spfi, SPFx } from "@pnp/sp";
import { graphfi, SPFx as GraphSPFx } from "@pnp/graph";
import { BackgroundVariant, resolveBackgroundVariant } from "./helpers/VisualHelper";
import {
  areAllEventTypesSelected,
  getSelectedEventTypes
} from "./helpers/EventSelectionHelper";

export default class EmpBirthdayWebPart extends BaseClientSideWebPart<IEmpBirthdayWebPartProps> {
  
  private _sp = spfi();
  private _graph = graphfi();

  public async onInit(): Promise<void> {
    await super.onInit();

    // Setup PnP Clients
    this._sp = spfi().using(SPFx(this.context));
    this._graph = graphfi().using(GraphSPFx(this.context));

    // Default property values if not set
    if (!this.properties.listName) this.properties.listName = "EmployeeBirthdays";
    if (!this.properties.daysAhead) this.properties.daysAhead = 15;
    if (!this.properties.newHireDays) this.properties.newHireDays = 30;
    if (!this.properties.eventFilter) this.properties.eventFilter = "both";
    this.initializeEventSelectionProperties();
    if (!this.properties.backgroundVariant) {
      this.properties.backgroundVariant = resolveBackgroundVariant(
        undefined,
        this.properties.backgroundImage
      );
    }
  }

  private getBackgroundOptions(): Array<{
    key: BackgroundVariant;
    text: string;
  }> {
    return [
      { key: "simple", text: "Simple" },
      { key: "celebration", text: "Celebration" },
      { key: "sunrise", text: "Sunrise" },
      { key: "meadow", text: "Meadow" },
      { key: "royal", text: "Royal" }
    ];
  }

  private initializeEventSelectionProperties(): void {
    const selectedEventTypes = getSelectedEventTypes(this.properties);

    if (this.properties.showAllCards === undefined) {
      this.properties.showAllCards = areAllEventTypesSelected(selectedEventTypes);
    }

    if (this.properties.showBirthdays === undefined) {
      this.properties.showBirthdays = selectedEventTypes.includes("birthday");
    }

    if (this.properties.showAnniversaries === undefined) {
      this.properties.showAnniversaries = selectedEventTypes.includes("anniversary");
    }

    if (this.properties.showNewHires === undefined) {
      this.properties.showNewHires = selectedEventTypes.includes("newHire");
    }
  }

  public render(): void {
    const selectedEventTypes = getSelectedEventTypes(this.properties);

    const element = React.createElement(EmpBirthday, {
      description: this.properties.description,
      heroEyebrowText: this.properties.heroEyebrowText,
      heroSubtitleText: this.properties.heroSubtitleText,
      heroHighlightText: this.properties.heroHighlightText,
      listName: this.properties.listName,
      daysAhead: this.properties.daysAhead,
      newHireDays: this.properties.newHireDays,
      backgroundVariant: this.properties.backgroundVariant,
      backgroundImage: this.properties.backgroundImage,
      selectedEventTypes: selectedEventTypes,

      // PnP
      sp: this._sp,
      graph: this._graph
    });

    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse("1.0");
  }

  protected onPropertyPaneFieldChanged(
    propertyPath: string,
    oldValue: unknown,
    newValue: unknown
  ): void {
    super.onPropertyPaneFieldChanged(propertyPath, oldValue, newValue);

    if (
      propertyPath !== "showAllCards" &&
      propertyPath !== "showBirthdays" &&
      propertyPath !== "showAnniversaries" &&
      propertyPath !== "showNewHires"
    ) {
      return;
    }

    if (propertyPath === "showAllCards" && Boolean(newValue)) {
      this.properties.showBirthdays = true;
      this.properties.showAnniversaries = true;
      this.properties.showNewHires = true;
    }

    const hasAnySelectedType = Boolean(this.properties.showBirthdays) ||
      Boolean(this.properties.showAnniversaries) ||
      Boolean(this.properties.showNewHires);

    if (!hasAnySelectedType) {
      this.properties.showAllCards = true;
      this.properties.showBirthdays = true;
      this.properties.showAnniversaries = true;
      this.properties.showNewHires = true;
    } else {
      this.properties.showAllCards = Boolean(this.properties.showBirthdays) &&
        Boolean(this.properties.showAnniversaries) &&
        Boolean(this.properties.showNewHires);
    }

    this.context.propertyPane.refresh();
    this.render();
  }

  // ----------------------------------------------------
  // PROPERTY PANE
  // ----------------------------------------------------
  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: "Celebrations & New Hires Web Part Settings" },
          groups: [
            {
              groupFields: [

                PropertyPaneTextField("description", {
                  label: "Webpart Title"
                }),

                PropertyPaneTextField("heroEyebrowText", {
                  label: "Hero Label"
                }),

                PropertyPaneTextField("heroSubtitleText", {
                  label: "Hero Description",
                  multiline: true
                }),

                PropertyPaneTextField("heroHighlightText", {
                  label: "Hero Highlight Text",
                  description: "Leave blank to show the next upcoming event automatically."
                }),

                PropertyPaneTextField("listName", {
                  label: "SharePoint List Name"
                }),

                PropertyPaneSlider("daysAhead", {
                  label: "Upcoming range (days)",
                  min: 1,
                  max: 90
                }),

                PropertyPaneSlider("newHireDays", {
                  label: "New hire lookback (days)",
                  min: 1,
                  max: 180
                }),

                PropertyPaneChoiceGroup("backgroundVariant", {
                  label: "Choose Background Style",
                  options: this.getBackgroundOptions()
                }),

                PropertyPaneCheckbox("showAllCards", {
                  text: "All"
                }),

                PropertyPaneCheckbox("showBirthdays", {
                  text: "Birthdays",
                  disabled: this.properties.showAllCards
                }),

                PropertyPaneCheckbox("showAnniversaries", {
                  text: "Anniversaries",
                  disabled: this.properties.showAllCards
                }),

                PropertyPaneCheckbox("showNewHires", {
                  text: "New Hires",
                  disabled: this.properties.showAllCards
                })

              ]
            }
          ]
        }
      ]
    };
  }
}

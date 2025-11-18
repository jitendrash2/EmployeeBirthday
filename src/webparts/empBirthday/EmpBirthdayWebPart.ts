import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneSlider,
  PropertyPaneChoiceGroup
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import * as React from 'react';
import * as ReactDom from 'react-dom';

import EmpBirthday from './components/EmpBirthday';
import { IEmpBirthdayWebPartProps } from './IEmpBirthdayWebPartProps';

import { spfi, SPFx } from "@pnp/sp";
import { graphfi, SPFx as GraphSPFx } from "@pnp/graph";

import img1 from './assets/bg/Image-1.png';
import img2 from './assets/bg/Image-2.png';
import img3 from './assets/bg/Image-3.png';
import img4 from './assets/bg/Image-4.png';

export default class EmpBirthdayWebPart extends BaseClientSideWebPart<IEmpBirthdayWebPartProps> {

  private _sp = spfi();
  private _graph = graphfi();

  private bgImages = [img1, img2, img3, img4];

  public async onInit(): Promise<void> {
    await super.onInit();
    this._sp = spfi().using(SPFx(this.context));
    this._graph = graphfi().using(GraphSPFx(this.context));
  }

  private getBackgroundOptions() {
    return this.bgImages.map((image, index) => ({
      key: image,
      text: "",
      imageSrc: image,
      selectedImageSrc: image,
      imageSize: { width: 80, height: 80 }
    }));
  }

  public render(): void {
    const element = React.createElement(EmpBirthday, {
      description: this.properties.description,
      listName: this.properties.listName,
      daysAhead: this.properties.daysAhead,
      backgroundImage: this.properties.backgroundImage,
      sp: this._sp,
      graph: this._graph
    });

    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: "Birthday Webpart Settings" },
          groups: [
            {
              groupFields: [
                PropertyPaneTextField("description", {
                  label: "Webpart Title"
                }),
                PropertyPaneTextField("listName", {
                  label: "SharePoint List Name"
                }),
                PropertyPaneSlider("daysAhead", {
                  label: "Days to look ahead",
                  min: 1,
                  max: 60
                }),
                PropertyPaneChoiceGroup("backgroundImage", {
                  label: "Choose Card Background",
                  options: this.getBackgroundOptions()
                })
              ]
            }
          ]
        }
      ]
    };
  }
}

import * as Yup from 'yup';
import React from 'react';
import { SubmitButton, Form as AntForm, Input, Radio, Select, TreeSelect } from 'formik-antd';
import { notification, Button } from 'antd';
import { history } from '@onaio/connected-reducer-registry';
import { getUser } from '@onaio/session-reducer';
import { OpenSRPService } from '@opensrp/server-service';
import { getAccessToken } from '@onaio/session-reducer';
import { Formik } from 'formik';
import {
  LocationUnitPayloadPOST,
  LocationUnitPayloadPUT,
  LocationUnitStatus,
  LocationUnitSyncStatus,
  LocationUnitTag,
} from '../../ducks/location-units';
import { useSelector } from 'react-redux';
import { Geometry } from 'geojson';
import { API_BASE_URL, LOCATION_UNIT_POST_PUT } from '../../constants';
import { v4 } from 'uuid';
import { LocationTag } from '../../ducks/location-tags';
import { ParsedHierarchySingleNode } from '../LocationTree/utils';

// TODO : need to resolve this data from server

export interface FormField {
  parentId: string;
  name: string;
  status: LocationUnitStatus;
  type: string;
  externalId?: string;
  locationTags?: number[];
  geometry?: string;
}

export interface Props {
  id?: string;
  initialValue?: FormField;
  locationtag: LocationTag[];
  treedata: ParsedHierarchySingleNode[];
}

/** yup validations for practitioner data object from form */
const userSchema = Yup.object().shape({
  parentId: Yup.string().typeError('Parentid must be a Number').required('Parentid is Required'),
  name: Yup.string().typeError('Name must be a String').required('Name is Required'),
  status: Yup.string().required('Status is Required'),
  type: Yup.string().typeError('Type must be a String').required('Type is Required'),
  externalId: Yup.string().typeError('External id must be a String'),
  locationTags: Yup.array().typeError('location Tags must be an Array'),
  geometry: Yup.string().typeError('location Tags must be a An String'),
});
const layout = { labelCol: { span: 8 }, wrapperCol: { span: 11 } };
const offsetLayout = { wrapperCol: { offset: 8, span: 11 } };
const status = [
  { label: 'Active', value: LocationUnitStatus.ACTIVE },
  { label: 'Inactive', value: LocationUnitStatus.INACTIVE },
];

const defaultProps: Required<Props> = {
  id: v4(),
  locationtag: [{ id: 0, active: false, name: '', description: '' }],
  treedata: [],
  initialValue: {
    parentId: '',
    name: '',
    status: LocationUnitStatus.ACTIVE,
    type: '',
    externalId: '',
    locationTags: [],
    geometry: '',
  },
};

export const Form: React.FC<Props> = (props: Props) => {
  const user = useSelector((state) => getUser(state));
  const accessToken = useSelector((state) => getAccessToken(state) as string);

  /**
   * Handle form submission
   *
   * @param {Object} values the form fields
   * @param {Function} setSubmitting method to set submission status
   */
  function onSubmit(values: FormField, setSubmitting: (isSubmitting: boolean) => void) {
    const locationTagFiler = props.locationtag?.filter((e) => values.locationTags?.includes(e.id));
    const locationTag = locationTagFiler?.map(
      (e) => ({ id: e.id, name: e.name } as LocationUnitTag)
    );

    const payload: (LocationUnitPayloadPOST | LocationUnitPayloadPUT) & {
      is_jurisdiction: true;
    } = {
      is_jurisdiction: true,
      properties: {
        username: user.username,
        externalId: values.externalId,
        parentId: values.parentId,
        name: values.name,
        // eslint-disable-next-line @typescript-eslint/camelcase
        name_en: values.name,
        status: values.status,
      },
      id: props.id,
      syncStatus: LocationUnitSyncStatus.SYNCED,
      type: values.type,
      locationTags: locationTag,
      geometry: values.geometry ? (JSON.parse(values.geometry) as Geometry) : undefined,
    };

    /** removes empty undefined and null objects before they payload is sent to server
     *
     * @param obj
     */
    function removeEmptykeys(obj: any) {
      Object.keys(obj).forEach(function (key) {
        if (obj[key] && typeof obj[key] === 'object') removeEmptykeys(obj[key]);
        else if (obj[key] === null || obj[key] === [] || obj[key] === {} || obj[key] === undefined)
          delete obj[key];
      });
    }
    removeEmptykeys(payload);
    // eslint-disable-next-line no-console
    console.log('payload : ', payload);

    const serve = new OpenSRPService(accessToken, API_BASE_URL, LOCATION_UNIT_POST_PUT);
    if (props.id) {
      serve
        .update(payload)
        .then(() => {
          notification.success({ message: 'User Updated successfully', description: '' });
          setSubmitting(false);
          history.goBack();
        })
        .catch((e: Error) => {
          notification.error({ message: `${e}`, description: '' });
          setSubmitting(false);
        });
    } else {
      serve
        .create(payload)
        .then(() => {
          notification.success({ message: 'User Created successfully', description: '' });
          setSubmitting(false);
          history.goBack();
        })
        .catch((e: Error) => {
          notification.error({ message: `${e}`, description: '' });
          setSubmitting(false);
        });
    }
  }

  return (
    <Formik
      initialValues={props.initialValue ? props.initialValue : defaultProps.initialValue}
      validationSchema={userSchema}
      onSubmit={(
        values: FormField,
        { setSubmitting }: { setSubmitting: (isSubmitting: boolean) => void }
      ) => onSubmit(values, setSubmitting)}
    >
      {({ isSubmitting, handleSubmit }) => {
        /** Function to parse the hierarchy tree into treeselect node format
         *
         * @param hierarchyNode
         */
        function parseHierarchyNode(hierarchyNode: ParsedHierarchySingleNode[]): JSX.Element[] {
          return hierarchyNode.map((node) => (
            <TreeSelect.TreeNode
              key={node.id}
              value={node.id}
              title={node.title}
              children={node.children && parseHierarchyNode(node.children)}
            />
          ));
        }

        return (
          <AntForm requiredMark={'optional'} {...layout} onSubmitCapture={handleSubmit}>
            <AntForm.Item label="Parent" name="parentId" required>
              <TreeSelect
                name="parentId"
                style={{ width: '100%' }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                placeholder="Please select"
              >
                {parseHierarchyNode(props.treedata)}
              </TreeSelect>
            </AntForm.Item>

            <AntForm.Item name="name" label="Name" required>
              <Input name="name" placeholder="Enter a location name" />
            </AntForm.Item>

            <AntForm.Item label="Status" name="status" valuePropName="checked" required>
              <Radio.Group name="status" defaultValue={props.initialValue?.status}>
                {status.map((e) => (
                  <Radio name="status" key={e.label} value={e.value}>
                    {e.label}
                  </Radio>
                ))}
              </Radio.Group>
            </AntForm.Item>

            <AntForm.Item name="type" label="Type" required>
              <Input name="type" placeholder="Select type" />
            </AntForm.Item>

            <AntForm.Item name="externalId" label="External ID">
              <Input name="externalId" placeholder="Select status" />
            </AntForm.Item>

            <AntForm.Item name="geometry" label="geometry">
              <Input.TextArea name="geometry" rows={4} placeholder="</> JSON" />
            </AntForm.Item>

            <AntForm.Item label="Unit Group" name="locationTags">
              <Select
                name="locationTags"
                mode="multiple"
                allowClear
                showSearch
                placeholder="Enter a location group name"
                optionFilterProp="children"
                filterOption={(input: string, option: any) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {props.locationtag.map((e) => (
                  <Select.Option key={e.id} value={e.id}>
                    {e.name}
                  </Select.Option>
                ))}
              </Select>
            </AntForm.Item>

            <AntForm.Item name="buttons" {...offsetLayout}>
              <SubmitButton id="submit">{isSubmitting ? 'Saving' : 'Save'}</SubmitButton>
              <Button id="cancel" onClick={() => history.goBack()} type="dashed">
                Cancel
              </Button>
            </AntForm.Item>
          </AntForm>
        );
      }}
    </Formik>
  );
};

Form.defaultProps = defaultProps;

export default Form;

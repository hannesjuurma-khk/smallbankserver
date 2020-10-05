import React from 'react';
import { Col, Row, Form } from 'reactstrap';

import './Dashboard.css'

import BalanceScreen from '../BalanceScreen/BalanceScreen'
import CustomFormGroup from '../FormComponents/CustomFormGroup/CustomFormGroup'

export default class LoginPage extends React.Component {

  render() {
    return (
      <Row className="h-100 w-100">
        <Col className="dashboard-background dashboard--form-padding d-flex align-items-center justify-content-center" sm="6">
          <div>
            <BalanceScreen/>

            <Form className=" w-100">
              <Row form>
                <Col sm={6}>
                  <CustomFormGroup placeholder="Enter amount..."/>
                  <CustomFormGroup isButton btntext="Deposit"/>
                </Col>
                <Col sm={6}>
                  <CustomFormGroup placeholder="Enter amount..."/>
                  <CustomFormGroup isButton btntext="Withdraw"/>
                </Col>
              </Row>
            </Form>
          </div>


        </Col>
        <Col className="d-flex align-items-center" sm="6">
          <Form className=" w-100">
            <CustomFormGroup placeholder="Account from..."/>
            <CustomFormGroup placeholder="Account to..."/>
            <CustomFormGroup placeholder="Amount..."/>
            <CustomFormGroup isButton btntext="Transfer money"/>
          </Form>
        </Col>
      </Row>
    )
  }
}
